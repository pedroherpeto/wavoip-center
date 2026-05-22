/**
 * Followup automatico de chamadas perdidas.
 *
 * Setting `missed_followup_enabled` controla. Quando uma chamada termina com
 * status=missed ou rejected, agenda mensagem WhatsApp em N segundos.
 */

import { prisma } from "../db/client";
import { eventBus } from "./eventBus";
import { getSession } from "../baileys/sessionManager";
import { pabxLogger as logger } from "../utils/logger";
import { getSettingSync } from "./settings";

// Dedup global
declare global {
  // eslint-disable-next-line no-var
  var __pabxFollowupScheduled: Set<number> | undefined;
}
const followupScheduled: Set<number> =
  globalThis.__pabxFollowupScheduled ?? new Set();
globalThis.__pabxFollowupScheduled = followupScheduled;

// Escuta call.completed (com callId garantido pelo callLogger).
// Trigger: status=missed OU status=rejected.
eventBus.on("call.completed" as any, (payload: any) => {
  if (payload.status !== "missed" && payload.status !== "rejected") return;
  if (followupScheduled.has(payload.callId)) {
    logger.debug({ callId: payload.callId }, "Followup ja agendado");
    return;
  }
  followupScheduled.add(payload.callId);
  maybeScheduleFollowup(payload);
});

async function maybeScheduleFollowup(payload: any) {
  try {
    if (!getSettingSync("missed_followup_enabled" as any)) return;
    if (!payload.callId) return;

    const delayMs =
      Number(getSettingSync("missed_followup_delay_seconds" as any) || 30) *
      1000;
    logger.info(
      { callId: payload.callId, delaySec: delayMs / 1000, status: payload.status },
      "Missed followup scheduled"
    );
    setTimeout(
      () =>
        sendFollowup(payload.callId).catch((e) =>
          logger.warn({ err: e }, "missed followup failed")
        ),
      delayMs
    );
  } catch (e) {
    logger.warn({ err: e }, "missed followup schedule failed");
  }
}

async function sendFollowup(callId: number): Promise<void> {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return;
  const wbot = getSession(call.sessionId);
  if (!wbot) return;
  const jid = `${call.fromNumber}@s.whatsapp.net`;
  const text = String(
    getSettingSync("missed_followup_message" as any) ||
      "Olá! Vi sua tentativa de ligação aqui. Posso te ajudar por aqui agora?"
  );
  await wbot.sendMessage(jid, { text });
  await prisma.callEvent.create({
    data: { callId, type: "missed_followup", payload: JSON.stringify({ text }) },
  });
  logger.info({ callId }, "Missed followup sent");
}
