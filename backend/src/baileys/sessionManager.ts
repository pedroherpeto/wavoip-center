/**
 * SessionManager - registry global de sessoes Baileys ativas.
 * Inspirado em StartAllWhatsAppsSessionsZPRO + StartWhatsAppSessionZPRO.
 */

import { loadBaileys } from "./adapter";
import { useAuthState, getSessionAuthPath } from "./multiFileAuth";
import { Boom } from "@hapi/boom";
import { prisma } from "../db/client";
import { baileysLogger as logger } from "../utils/logger";
import { eventBus } from "../pabx/eventBus";
import { attachCallMonitor } from "./monitor";
import { attachMessageListener } from "./messageListener";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";

type WASocket = any;

const sessions = new Map<number, WASocket>();
const bootFailures = new Map<number, number>();
const MAX_BOOT_FAILURES = 5;

export function getSession(sessionId: number): WASocket | undefined {
  return sessions.get(sessionId);
}

export function listActiveSessions(): number[] {
  return Array.from(sessions.keys());
}

async function updateStatus(
  sessionId: number,
  status: "OPENING" | "CONNECTED" | "DISCONNECTED" | "QRCODE",
  extra: { qrcode?: string | null; number?: string | null } = {}
) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status,
      ...(extra.qrcode !== undefined && { qrcode: extra.qrcode }),
      ...(extra.number !== undefined && { number: extra.number }),
    },
  });
  eventBus.emit("session.status", {
    sessionId,
    status,
    qrcode: extra.qrcode ?? undefined,
    number: extra.number ?? undefined,
  });
}

export async function startSession(sessionId: number): Promise<void> {
  if (sessions.has(sessionId)) {
    logger.warn({ sessionId }, "Session already active, skipping start");
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (!session.isActive) {
    logger.warn({ sessionId }, "Session inactive, skipping start");
    return;
  }

  await updateStatus(sessionId, "OPENING", { qrcode: null });

  logger.debug({ sessionId }, "Loading baileys lib...");
  const baileys = await loadBaileys();
  const {
    makeWASocket,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
    makeCacheableSignalKeyStore,
  } = baileys;

  const authPath = session.authPath || getSessionAuthPath(sessionId, session.name);
  logger.debug({ sessionId, authPath }, "Loading auth state...");
  const { state, saveCreds } = await useAuthState(authPath);

  logger.debug({ sessionId }, "Fetching latest baileys version...");
  let version: number[] = [2, 3000, 1039785632];
  try {
    const res = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("fetchLatestBaileysVersion timeout")), 8000)),
    ]) as { version: number[] };
    version = res.version;
  } catch (e) {
    logger.warn({ sessionId, err: (e as Error).message }, "fetchLatestBaileysVersion failed, using fallback");
  }

  logger.info({ sessionId, name: session.name, baileysVersion: version }, "Starting WASocket");

  const socketLogger = logger.child({ sessionId, name: session.name });

  const wbot: WASocket = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, socketLogger),
    },
    browser: Browsers.appropriate("Chrome"),
    logger: socketLogger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  (wbot as any).id = sessionId;

  wbot.ev.on("creds.update", saveCreds);

  wbot.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ sessionId }, "QR code received");
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        await updateStatus(sessionId, "QRCODE", { qrcode: qrDataUrl });
        if (process.env.NODE_ENV !== "production") {
          qrcodeTerminal.generate(qr, { small: true });
        }
      } catch (e) {
        logger.error({ sessionId, err: e }, "Failed to encode QR");
      }
    }

    if (connection === "open") {
      bootFailures.delete(sessionId);
      const wid = (wbot as any).user?.id ?? null;
      const number = wid ? String(wid).split(":")[0].split("@")[0] : null;
      await updateStatus(sessionId, "CONNECTED", { qrcode: null, number });
      logger.info({ sessionId, number }, "Session CONNECTED");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      sessions.delete(sessionId);
      await updateStatus(sessionId, "DISCONNECTED");
      logger.warn(
        { sessionId, code, shouldReconnect },
        "Session closed"
      );

      if (shouldReconnect) {
        const failures = (bootFailures.get(sessionId) || 0) + 1;
        bootFailures.set(sessionId, failures);
        if (failures >= MAX_BOOT_FAILURES) {
          logger.error({ sessionId, failures }, "Max boot failures, disabling session");
          await prisma.session.update({
            where: { id: sessionId },
            data: { isActive: false, retries: failures },
          });
          bootFailures.delete(sessionId);
          return;
        }
        const delayMs = Math.min(30_000, 2000 * failures);
        setTimeout(() => startSession(sessionId).catch((e) => logger.error({ err: e }, "reconnect failed")), delayMs);
      }
    }
  });

  sessions.set(sessionId, wbot);

  // Anexa monitor de chamadas (CB:call) e listener de mensagens (IVR + NPS)
  attachCallMonitor(wbot, sessionId);
  attachMessageListener(wbot, sessionId);
  try {
    const { attachNpsMessageListener } = await import("../pabx/nps");
    attachNpsMessageListener(wbot);
  } catch (e) {
    logger.warn({ err: e }, "attach NPS listener failed");
  }
}

export async function stopSession(sessionId: number): Promise<void> {
  const wbot = sessions.get(sessionId);
  if (!wbot) return;
  try {
    await wbot.logout?.();
  } catch {
    // ignore
  }
  sessions.delete(sessionId);
  await updateStatus(sessionId, "DISCONNECTED", { qrcode: null });
}

export async function startAllActiveSessions(): Promise<void> {
  const active = await prisma.session.findMany({ where: { isActive: true } });
  logger.info({ count: active.length }, "Starting active sessions");
  for (const s of active) {
    startSession(s.id).catch((e) => logger.error({ sessionId: s.id, err: e }, "Failed to start session"));
  }
}
