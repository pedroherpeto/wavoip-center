/**
 * NPS pos-chamada.
 *
 * Quando uma chamada termina (status=completed e duration > 30s):
 *  1. Agenda envio em 10min (setting `nps_delay_seconds`)
 *  2. Envia: "Em uma escala de 0 a 10, quanto recomendaria nosso atendimento?"
 *  3. Listener em messages.upsert: se proximo texto for "0..10", persiste
 *     em CallRating
 *  4. Detractor (0-6) -> notifica supervisor (setting `nps_supervisor_phone`)
 */

import { prisma } from "../db/client";
import { eventBus } from "./eventBus";
import { getSession } from "../baileys/sessionManager";
import { pabxLogger as logger } from "../utils/logger";
import { getSettingSync, SETTING_DEFS } from "./settings";

// Mapa em memoria GLOBAL (sobrevive a hot reloads do tsx watch).
// Listener anexado em outra encarnacao do modulo precisa ver o mesmo state.
type PendingEntry = { callId: number; sessionId: number; sentAt: number };
declare global {
  // eslint-disable-next-line no-var
  var __pabxPendingRatings: Map<string, PendingEntry> | undefined;
}
const pendingRatings: Map<string, PendingEntry> =
  globalThis.__pabxPendingRatings ?? new Map();
globalThis.__pabxPendingRatings = pendingRatings;

const RATING_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h pra responder

// Adiciona settings de NPS dinamicamente (sem migration)
declare module "./settings" {}

function shouldRun(): boolean {
  return Boolean(getSettingSync("nps_enabled" as any));
}

function npsMessage(): string {
  return String(
    getSettingSync("nps_message" as any) ||
      "Obrigado pela ligacao! Numa escala de 0 a 10, quanto voce indicaria nosso atendimento? Responda apenas o numero."
  );
}

// Dedup global pra evitar agendar NPS 2x quando eventos sao re-emitidos
declare global {
  // eslint-disable-next-line no-var
  var __pabxNpsScheduled: Set<number> | undefined;
}
const npsScheduled: Set<number> =
  globalThis.__pabxNpsScheduled ?? new Set();
globalThis.__pabxNpsScheduled = npsScheduled;

eventBus.on("call.completed" as any, async (payload: any) => {
  try {
    if (!shouldRun()) return;
    if (!payload.callId) return;
    if (npsScheduled.has(payload.callId)) {
      logger.debug({ callId: payload.callId }, "NPS ja agendado pra esta call");
      return;
    }
    const minDuration = Number(
      getSettingSync("nps_min_duration_seconds" as any) ?? 30
    );
    if (minDuration > 0) {
      if (!payload.durationSec || payload.durationSec < minDuration) {
        logger.debug(
          { callId: payload.callId, duration: payload.durationSec, minDuration },
          "NPS skipped - duration below threshold"
        );
        return;
      }
    }
    if (payload.status !== "completed" && payload.status !== "terminated") {
      logger.debug({ callId: payload.callId, status: payload.status }, "NPS skipped - status");
      return;
    }

    const delayMs =
      (Number(getSettingSync("nps_delay_seconds" as any)) || 600) * 1000;

    npsScheduled.add(payload.callId);
    logger.info(
      { callId: payload.callId, delaySec: delayMs / 1000 },
      "NPS scheduled"
    );
    setTimeout(
      () =>
        sendNpsAsk(payload.callId, payload.sessionId, payload.from).catch((e) =>
          logger.warn({ err: e }, "sendNpsAsk failed")
        ),
      delayMs
    );
  } catch (e) {
    logger.warn({ err: e }, "NPS schedule failed");
  }
});

async function sendNpsAsk(
  callId: number,
  sessionId: number,
  phone: string
): Promise<void> {
  const wbot = getSession(sessionId);
  if (!wbot) {
    logger.warn({ sessionId, callId }, "NPS: wbot not active");
    return;
  }
  const jid = `${phone}@s.whatsapp.net`;
  await wbot.sendMessage(jid, { text: npsMessage() });
  pendingRatings.set(phone, { callId, sessionId, sentAt: Date.now() });
  logger.info({ callId, phone }, "NPS question sent");
}

// Listener pra capturar resposta numerica do cliente
export function attachNpsMessageListener(wbot: any): void {
  // Marca no wbot pra evitar duplicar listener em re-chamadas
  if ((wbot as any).__pabxNpsAttached) return;
  (wbot as any).__pabxNpsAttached = true;

  wbot.ev?.on?.("messages.upsert", async (m: any) => {
    if (!shouldRun()) return;
    try {
      const msgs = m?.messages ?? [];
      for (const msg of msgs) {
        if (msg.key?.fromMe) continue;
        const from = msg.key?.remoteJid;
        if (!from) continue;

        // Multi-Device manda mensagens com @lid; o PN real esta em outros campos
        const fromRaw = String(from).split("@")[0].split(":")[0];
        const fromAlt = msg.key?.senderPn
          ? String(msg.key.senderPn).split("@")[0].split(":")[0]
          : msg.key?.participantPn
            ? String(msg.key.participantPn).split("@")[0].split(":")[0]
            : null;

        const map = globalThis.__pabxPendingRatings as Map<string, PendingEntry>;
        let pending = map?.get(fromRaw) ?? (fromAlt ? map?.get(fromAlt) : undefined);

        // Fallback 1: busca a Call mais recente desse JID (LID ou PN)
        if (!pending && map && map.size > 0) {
          try {
            const lookback = new Date(Date.now() - RATING_WINDOW_MS);
            const candidatePhones = [fromRaw, fromAlt].filter(Boolean) as string[];
            const recentCall = await prisma.call.findFirst({
              where: {
                startedAt: { gte: lookback },
                OR: candidatePhones.flatMap((p) => [
                  { fromNumber: p },
                  { whatsappCallId: { contains: p } as any },
                ]),
              },
              orderBy: { startedAt: "desc" },
            });
            if (recentCall) {
              pending = map.get(recentCall.fromNumber);
              if (pending)
                logger.debug(
                  { phone: fromRaw, matched: recentCall.fromNumber },
                  "NPS pending resolvido via Call recente"
                );
            }
          } catch (e) {
            logger.debug({ err: e }, "NPS lookup recent call failed");
          }
        }

        // Fallback 2: ambiguidade resolvida por recencia.
        // Se ha pendings ativos, assume que e do mais recente
        // (o widget Multi-Device usa @lid que dificulta matching por phone).
        if (!pending && map && map.size > 0) {
          let mostRecent: PendingEntry | undefined;
          let mostRecentTs = 0;
          for (const v of map.values()) {
            if (v.sentAt > mostRecentTs) {
              mostRecent = v;
              mostRecentTs = v.sentAt;
            }
          }
          // So usa se o NPS foi enviado nos ultimos 30min
          if (
            mostRecent &&
            Date.now() - mostRecent.sentAt < 30 * 60 * 1000
          ) {
            pending = mostRecent;
            logger.info(
              {
                phone: fromRaw,
                callId: mostRecent.callId,
                age_seconds: Math.round((Date.now() - mostRecent.sentAt) / 1000),
              },
              "NPS pending resolvido por recencia (LID/PN mismatch)"
            );
          }
        }

        if (!pending) {
          logger.debug(
            { phone: fromRaw, fromAlt, pendingCount: map?.size ?? 0 },
            "NPS msg recebida mas sem pending pra esse numero"
          );
          continue;
        }
        const phone = pending
          ? Array.from(map.entries()).find(([_, v]) => v === pending)?.[0] ??
            fromRaw
          : fromRaw;
        if (Date.now() - pending.sentAt > RATING_WINDOW_MS) {
          map.delete(phone);
          continue;
        }
        const text =
          msg.message?.conversation ??
          msg.message?.extendedTextMessage?.text ??
          "";
        const trimmed = String(text).trim();
        const num = Number(trimmed);
        if (!Number.isFinite(num) || num < 0 || num > 10) {
          logger.debug(
            { phone, text: trimmed },
            "NPS msg nao parseou pra numero 0-10"
          );
          continue;
        }
        const score = Math.round(num);

        await prisma.callRating
          .create({
            data: { callId: pending.callId, phone, score },
          })
          .catch((e) => logger.warn({ err: e }, "save CallRating failed"));

        // Remove a key real (que pode ser PN ou LID)
        for (const [key, val] of map.entries()) {
          if (val === pending) map.delete(key);
        }
        logger.info({ callId: pending.callId, phone, score }, "NPS rating saved");

        // Detractor -> alerta supervisor
        if (score <= 6) {
          const supPhone = String(
            getSettingSync("nps_supervisor_phone" as any) || ""
          ).replace(/\D/g, "");
          if (!supPhone) {
            logger.debug("Detractor mas sem nps_supervisor_phone configurado");
          } else {
            // Anti-loop: nao manda pra o proprio numero da sessao
            const session = await prisma.session.findUnique({
              where: { id: pending.sessionId },
            });
            const sessionPhone = (session?.number ?? "").replace(/\D/g, "");
            if (sessionPhone && sessionPhone === supPhone) {
              logger.warn(
                { supPhone, sessionPhone },
                "nps_supervisor_phone IGUAL ao numero da sessao - WhatsApp nao entrega msg de si pra si. Configure outro numero."
              );
            } else {
              try {
                await wbot.sendMessage(`${supPhone}@s.whatsapp.net`, {
                  text: `[ALERTA NPS] Score ${score}/10 de ${phone} (chamada #${pending.callId})`,
                });
                logger.info(
                  { supPhone, score, callId: pending.callId },
                  "NPS supervisor alerted"
                );
              } catch (e) {
                logger.warn({ err: e }, "NPS supervisor alert failed");
              }
            }
          }
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "NPS message listener error");
    }
  });
}
