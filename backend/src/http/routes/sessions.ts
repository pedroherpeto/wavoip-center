import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { startSession, stopSession, getSession } from "../../baileys/sessionManager";
import { getSessionAuthPath, clearAuthState } from "../../baileys/multiFileAuth";
import { getSettingSync } from "../../pabx/settings";
import { NotFoundError, AppError } from "../../utils/errors";

const WelcomeStepSchema = z.object({
  type: z.enum(["text", "audio", "image"]),
  text: z.string().optional(),
  audioUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  caption: z.string().optional(),
  delayMs: z.number().int().min(0).max(10_000).optional(),
  injectOnAnswer: z.boolean().optional(),
});
const WelcomeSequenceSchema = z.array(WelcomeStepSchema);

const CreateSessionSchema = z.object({
  name: z.string().min(1).max(100),
  locale: z.enum(["pt-BR", "en-US"]).optional(),
  wavoipTokens: z.string().optional(),
  rejectCalls: z.boolean().optional(),
  callRejectMessage: z.string().optional(),
  welcomeSequence: z
    .union([WelcomeSequenceSchema, z.string(), z.null()])
    .optional(),
  ivrEnabled: z.boolean().optional(),
  defaultFlowId: z.number().int().optional(),
});

const UpdateSessionSchema = CreateSessionSchema.partial();

export async function sessionRoutes(app: FastifyInstance) {
  app.get("/sessions", async () => {
    return prisma.session.findMany({
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/sessions/:id", async (req) => {
    const id = Number((req.params as any).id);
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) throw new NotFoundError("Session");
    return s;
  });

  app.post("/sessions", async (req) => {
    const body = CreateSessionSchema.parse((req as any).body);
    const defaultLocale = getSettingSync("default_locale");
    const welcomeSequence =
      typeof body.welcomeSequence === "string"
        ? body.welcomeSequence
        : body.welcomeSequence
          ? JSON.stringify(body.welcomeSequence)
          : null;
    const created = await prisma.session.create({
      data: {
        name: body.name,
        locale: body.locale ?? (defaultLocale === "en-US" ? "en-US" : "pt-BR"),
        wavoipTokens: body.wavoipTokens,
        rejectCalls: body.rejectCalls ?? getSettingSync("reject_calls_default"),
        callRejectMessage: body.callRejectMessage,
        welcomeSequence,
        ivrEnabled: body.ivrEnabled ?? false,
        defaultFlowId: body.defaultFlowId,
        authPath: "",
      },
    });
    const authPath = getSessionAuthPath(created.id, created.name);
    const updated = await prisma.session.update({
      where: { id: created.id },
      data: { authPath },
    });
    return updated;
  });

  app.put("/sessions/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = UpdateSessionSchema.parse((req as any).body);
    const data: any = { ...body };
    if (body.welcomeSequence !== undefined) {
      data.welcomeSequence =
        typeof body.welcomeSequence === "string"
          ? body.welcomeSequence
          : body.welcomeSequence
            ? JSON.stringify(body.welcomeSequence)
            : null;
    }
    const updated = await prisma.session.update({ where: { id }, data });
    return updated;
  });

  app.delete("/sessions/:id", async (req) => {
    const id = Number((req.params as any).id);
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) throw new NotFoundError("Session");
    await stopSession(id).catch(() => undefined);
    if (s.authPath) clearAuthState(s.authPath);
    await prisma.session.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/sessions/:id/start", async (req) => {
    const id = Number((req.params as any).id);
    startSession(id).catch(() => undefined);
    return { ok: true, sessionId: id };
  });

  app.post("/sessions/:id/stop", async (req) => {
    const id = Number((req.params as any).id);
    await stopSession(id);
    return { ok: true };
  });

  app.get("/sessions/:id/qrcode", async (req, reply) => {
    const id = Number((req.params as any).id);
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) throw new NotFoundError("Session");
    if (!s.qrcode) {
      reply.code(404);
      return { error: "QR code not available", status: s.status };
    }
    return { qrcode: s.qrcode, status: s.status };
  });

  app.post("/sessions/:id/send-message", async (req) => {
    const id = Number((req.params as any).id);
    const Schema = z.object({
      to: z.string().min(5),
      text: z.string().min(1).max(4096),
    });
    const body = Schema.parse((req as any).body);

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundError("Session");
    if (session.status !== "CONNECTED") {
      throw new AppError("Session not connected", 409);
    }

    const wbot = getSession(id);
    if (!wbot) throw new AppError("WhatsApp socket not active", 409);

    const phone = body.to.replace(/\D/g, "");
    const jid = phone.includes("@") ? body.to : `${phone}@s.whatsapp.net`;

    try {
      const result = await wbot.sendMessage(jid, { text: body.text });
      return {
        ok: true,
        to: jid,
        whatsappMessageId: result?.key?.id ?? null,
      };
    } catch (e) {
      throw new AppError(`sendMessage failed: ${(e as Error).message}`, 500);
    }
  });

  app.get("/sessions/:id/qr.html", async (req, reply) => {
    const id = Number((req.params as any).id);
    const s = await prisma.session.findUnique({ where: { id } });
    if (!s) throw new NotFoundError("Session");

    const qrImg = s.qrcode
      ? `<img src="${s.qrcode}" alt="QR code" style="width:320px;height:320px;image-rendering:pixelated;border-radius:12px;background:#fff;padding:16px;" />`
      : `<div class="placeholder">${s.status === "CONNECTED" ? "Sessao ja conectada (numero " + (s.number ?? "?") + ")" : "Aguardando QR... status: " + s.status}</div>`;

    reply.type("text/html; charset=utf-8");
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="refresh" content="3" />
<title>Wavoip PABX - QR ${s.name}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #0a0a0a;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px;
  }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
  p.sub { color: #a3a3a3; margin: 0 0 24px; font-size: 14px; }
  .card {
    background: #171717;
    border: 1px solid #262626;
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .placeholder {
    width: 320px; height: 320px;
    display: flex; align-items: center; justify-content: center;
    background: #262626; border-radius: 12px; color: #a3a3a3; text-align: center;
    padding: 24px; font-size: 14px;
  }
  .status {
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    background: ${s.status === "CONNECTED" ? "#14532d" : s.status === "QRCODE" ? "#7c3a03" : "#3f3f46"};
    color: ${s.status === "CONNECTED" ? "#86efac" : s.status === "QRCODE" ? "#fdba74" : "#d4d4d8"};
  }
  small { color: #737373; font-size: 12px; }
  a { color: #25D366; text-decoration: none; }
</style>
</head>
<body>
  <h1>${s.name}</h1>
  <p class="sub">Sessao #${s.id} - escaneie com WhatsApp &gt; Aparelhos conectados</p>
  <div class="card">
    ${qrImg}
    <span class="status">${s.status}</span>
    <small>Pagina atualiza a cada 3s &middot; <a href="/sessions/${s.id}">JSON</a></small>
  </div>
</body>
</html>`;
  });
}
