import { prisma } from "../db/client";
import { eventBus } from "./eventBus";
import { pabxLogger as logger } from "../utils/logger";

eventBus.on("call.incoming", async (payload) => {
  try {
    const existing = payload.whatsappCallId
      ? await prisma.call.findUnique({ where: { whatsappCallId: payload.whatsappCallId } })
      : null;
    if (existing) return;

    const call = await prisma.call.create({
      data: {
        sessionId: payload.sessionId,
        direction: "incoming",
        fromNumber: payload.from,
        whatsappCallId: payload.whatsappCallId,
        status: "ringing",
        startedAt: new Date(payload.timestamp),
        events: {
          create: { type: "ring", payload: JSON.stringify(payload.raw ?? null) },
        },
      },
    });
    payload.callId = call.id;
    eventBus.emit("call.persisted", payload);
    logger.info({ callId: call.id, from: payload.from }, "Incoming call logged");
  } catch (e) {
    logger.error({ err: e, payload }, "Failed to log incoming call");
  }
});

eventBus.on("call.accepted", async (payload) => {
  if (!payload.whatsappCallId) return;
  try {
    await prisma.call.update({
      where: { whatsappCallId: payload.whatsappCallId },
      data: {
        status: "answered",
        events: { create: { type: "accept", payload: JSON.stringify(payload.raw ?? null) } },
      },
    });
  } catch {}
});

async function finalizeCall(payload: any, status: string) {
  if (!payload.whatsappCallId) return;
  try {
    const call = await prisma.call.findUnique({
      where: { whatsappCallId: payload.whatsappCallId },
    });
    if (!call) return;
    const durationSec =
      payload.durationSec ?? Math.round((Date.now() - call.startedAt.getTime()) / 1000);
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status,
        durationSec,
        endedAt: new Date(),
        events: { create: { type: status, payload: JSON.stringify(payload.raw ?? null) } },
      },
    });
    // Re-emite com callId/durationSec setados - listeners de NPS/IA/Followup
    // dependem desses campos (registrados via "call.completed.<status>")
    eventBus.emit("call.completed" as any, {
      ...payload,
      callId: call.id,
      sessionId: call.sessionId,
      from: call.fromNumber,
      direction: call.direction,
      durationSec,
      status,
      timestamp: Date.now(),
    });
    logger.info({ callId: call.id, status, durationSec }, "Call finalized");
  } catch (e) {
    logger.error({ err: e }, "Failed to finalize call");
  }
}

eventBus.on("call.rejected", (p) => finalizeCall(p, "rejected"));
eventBus.on("call.missed", (p) => finalizeCall(p, "missed"));
eventBus.on("call.terminated", (p) => finalizeCall(p, "terminated"));
