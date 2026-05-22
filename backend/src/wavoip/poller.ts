/**
 * Poller da Wavoip API.
 *
 * A cada WAVOIP_POLL_INTERVAL_MS:
 *  1. Para cada Session conectada com wavoipTokens != null, divide o CSV
 *     e chama fetchCallsByToken(token).
 *  2. Reconcilia cada WavoipCall com uma Call do banco usando:
 *     a) whatsappCallId (preferido) -> match exato
 *     b) fromNumber + janela de tempo de +-2min -> match aproximado
 *  3. Atualiza wavoipCallId, durationSec e status quando informados.
 *
 * O poller eh tolerante a falhas: erro em um token nao afeta os demais.
 */

import { config } from "../config";
import { logger } from "../utils/logger";
import { prisma } from "../db/client";
import { fetchCallsByToken } from "./client";
import type { WavoipCall } from "./types";

const pollerLogger = logger.child({ module: "wavoip-poller" });

let timer: NodeJS.Timeout | null = null;
let running = false;

function normalizePhone(s?: string | null): string {
  if (!s) return "";
  return s.replace(/\D/g, "");
}

function mapStatus(s?: string): string | null {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v.includes("answer") || v.includes("accept")) return "answered";
  if (v.includes("reject")) return "rejected";
  if (v.includes("miss") || v.includes("unanswered") || v.includes("no_answer")) return "missed";
  if (v.includes("complet") || v.includes("ended") || v.includes("hangup")) return "completed";
  return null;
}

async function reconcileOne(sessionId: number, wcall: WavoipCall): Promise<void> {
  const wavoipCallId = String(wcall.id);
  const whatsappCallId = wcall.whatsapp_call_id || null;
  const fromCandidate = normalizePhone(wcall.from || wcall.caller);
  const startedAtIso = wcall.created_date || wcall.createdAt;
  const startedAt = startedAtIso ? new Date(startedAtIso) : null;

  let call =
    whatsappCallId
      ? await prisma.call.findUnique({ where: { whatsappCallId } })
      : null;

  if (!call && fromCandidate && startedAt) {
    const min = new Date(startedAt.getTime() - 2 * 60_000);
    const max = new Date(startedAt.getTime() + 2 * 60_000);
    call = await prisma.call.findFirst({
      where: {
        sessionId,
        fromNumber: { contains: fromCandidate.slice(-8) },
        startedAt: { gte: min, lte: max },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  if (!call) return;

  const newStatus = mapStatus(wcall.status);
  const updates: any = {};
  if (call.wavoipCallId !== wavoipCallId) updates.wavoipCallId = wavoipCallId;
  if (typeof wcall.duration === "number" && wcall.duration > 0 && wcall.duration !== call.durationSec) {
    updates.durationSec = wcall.duration;
  }
  if (newStatus && newStatus !== call.status) updates.status = newStatus;

  if (Object.keys(updates).length === 0) return;

  try {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        ...updates,
        events: {
          create: {
            type: "wavoip_sync",
            payload: JSON.stringify({ wavoipCallId, status: wcall.status, duration: wcall.duration }),
          },
        },
      },
    });
    pollerLogger.debug({ callId: call.id, updates }, "Call enriched from Wavoip");
  } catch (e) {
    pollerLogger.warn({ err: e, callId: call.id }, "Failed to update call from Wavoip data");
  }
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const sessions = await prisma.session.findMany({
      where: { status: "CONNECTED", isActive: true, NOT: { wavoipTokens: null } },
      select: { id: true, wavoipTokens: true },
    });
    if (sessions.length === 0) return;

    for (const s of sessions) {
      const tokens = (s.wavoipTokens ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        const calls = await fetchCallsByToken(token);
        for (const wcall of calls) {
          await reconcileOne(s.id, wcall).catch((e) =>
            pollerLogger.warn({ err: e }, "reconcileOne failed")
          );
        }
      }
    }
  } catch (e) {
    pollerLogger.error({ err: e }, "Poller tick failed");
  } finally {
    running = false;
  }
}

export function startWavoipPoller(): void {
  if (timer) return;
  pollerLogger.info({ intervalMs: config.WAVOIP_POLL_INTERVAL_MS }, "Wavoip poller starting");
  timer = setInterval(tick, config.WAVOIP_POLL_INTERVAL_MS);
}

export function stopWavoipPoller(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  pollerLogger.info("Wavoip poller stopped");
}

export function isPollerRunning(): boolean {
  return timer !== null;
}
