import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { getSession } from "../../baileys/sessionManager";
import { eventBus } from "../../pabx/eventBus";
import { NotFoundError, AppError } from "../../utils/errors";
import { httpLogger as logger } from "../../utils/logger";

const ListQuerySchema = z.object({
  sessionId: z.coerce.number().int().optional(),
  fromNumber: z.string().optional(),
  status: z.string().optional(),
  direction: z.enum(["incoming", "outgoing"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function callRoutes(app: FastifyInstance) {
  app.get("/calls", async (req) => {
    const q = ListQuerySchema.parse((req as any).query);
    const where: any = {};
    if (q.sessionId) where.sessionId = q.sessionId;
    if (q.fromNumber) where.fromNumber = q.fromNumber;
    if (q.status) where.status = q.status;
    if (q.direction) where.direction = q.direction;

    const [items, count] = await Promise.all([
      prisma.call.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: q.offset,
        take: q.limit,
        include: { session: { select: { id: true, name: true, number: true } } },
      }),
      prisma.call.count({ where }),
    ]);
    return { items, count, limit: q.limit, offset: q.offset };
  });

  app.get("/calls/:id", async (req) => {
    const id = Number((req.params as any).id);
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        session: { select: { id: true, name: true, number: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!call) throw new NotFoundError("Call");
    return call;
  });

  app.post("/calls/:id/reject", async (req) => {
    const id = Number((req.params as any).id);
    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) throw new NotFoundError("Call");
    if (!call.whatsappCallId) {
      throw new AppError("Call has no whatsappCallId - cannot reject via Baileys", 400);
    }

    const wbot = getSession(call.sessionId);
    if (!wbot) {
      throw new AppError("WhatsApp session not active", 409);
    }

    const jid = `${call.fromNumber}@s.whatsapp.net`;
    try {
      await wbot.rejectCall?.(call.whatsappCallId, jid);
      logger.info({ callId: id, from: call.fromNumber }, "Call rejected via API");
    } catch (e) {
      throw new AppError(`rejectCall failed: ${(e as Error).message}`, 500);
    }

    await prisma.call.update({
      where: { id },
      data: {
        status: "rejected",
        endedAt: new Date(),
        events: { create: { type: "reject_api", payload: null } },
      },
    });

    eventBus.emit("call.rejected", {
      sessionId: call.sessionId,
      callId: id,
      whatsappCallId: call.whatsappCallId,
      from: call.fromNumber,
      direction: "incoming",
      timestamp: Date.now(),
      raw: { source: "api" },
    });

    return { ok: true };
  });

  app.post("/calls/:id/end", async (req) => {
    const id = Number((req.params as any).id);
    const call = await prisma.call.findUnique({ where: { id } });
    if (!call) throw new NotFoundError("Call");

    const durationSec =
      call.startedAt && !call.endedAt
        ? Math.round((Date.now() - call.startedAt.getTime()) / 1000)
        : call.durationSec ?? undefined;

    await prisma.call.update({
      where: { id },
      data: {
        status: "completed",
        endedAt: new Date(),
        durationSec,
        events: { create: { type: "end_api", payload: null } },
      },
    });

    eventBus.emit("call.terminated", {
      sessionId: call.sessionId,
      callId: id,
      whatsappCallId: call.whatsappCallId ?? undefined,
      from: call.fromNumber,
      direction: (call.direction as "incoming" | "outgoing") || "incoming",
      timestamp: Date.now(),
      raw: { source: "api" },
    });

    return { ok: true };
  });

  app.get("/calls/metrics/summary", async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const all = await prisma.call.groupBy({
      by: ["status"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    });
    return {
      since: since.toISOString(),
      byStatus: all.map((r) => ({ status: r.status, count: r._count._all })),
    };
  });
}
