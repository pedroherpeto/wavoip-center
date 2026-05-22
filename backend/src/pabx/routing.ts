/**
 * Smart routing - avaliado no call.incoming antes do auto-reply.
 *
 * 3 verificacoes built-in (sempre rodam):
 *  1. Blacklist (ContactTag.tag = "blocked") -> rejeita silenciosamente
 *  2. VIP (ContactTag.tag = "vip") -> emite "call.vip" no eventBus + push opcional
 *  3. Repeat caller -> COUNT > 3 chamadas nas ultimas 24h
 *
 * Plus: RoutingRule customizadas (JSON condition/action) avaliadas em ordem
 * de prioridade. Primeira que matchar para o pipeline.
 */

import { prisma } from "../db/client";
import { eventBus } from "./eventBus";
import { pabxLogger as logger } from "../utils/logger";

export interface RoutingResult {
  // Se true, o autoReply NAO deve continuar (chamada ja foi tratada)
  shortCircuit: boolean;
  reason?: string;
  tag?: string;
}

export async function evaluateRouting(payload: {
  sessionId: number;
  from: string;
  whatsappCallId?: string;
}): Promise<RoutingResult> {
  const phone = payload.from;
  try {
    // 1. Blacklist
    const tag = await prisma.contactTag.findUnique({ where: { phone } });
    if (tag?.tag === "blocked") {
      logger.info({ phone, sessionId: payload.sessionId }, "Routing: BLOCKED");
      return { shortCircuit: true, reason: "blacklist", tag: "blocked" };
    }

    // 2. VIP - nao curto-circuita, apenas emite evento
    if (tag?.tag === "vip") {
      logger.info({ phone, sessionId: payload.sessionId }, "Routing: VIP caller");
      eventBus.emit("call.incoming", {
        ...(payload as any),
        timestamp: Date.now(),
        direction: "incoming",
        vip: true,
      } as any);
    }

    // 3. Repeat caller (3+ nas ultimas 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.call.count({
      where: {
        fromNumber: phone,
        startedAt: { gte: since },
      },
    });
    if (recentCount >= 3) {
      logger.info(
        { phone, recentCount, sessionId: payload.sessionId },
        "Routing: repeat caller"
      );
      // marca metadata no proximo call (sera escrito em callLogger)
      (payload as any).repeatCaller = true;
    }

    // 4. Custom rules (avaliadas em prioridade ASC)
    const rules = await prisma.routingRule.findMany({
      where: { active: true },
      orderBy: { priority: "asc" },
    });
    for (const rule of rules) {
      try {
        const cond = JSON.parse(rule.condition);
        const action = JSON.parse(rule.action);
        if (matchCondition(cond, { phone, recentCount, tag: tag?.tag })) {
          logger.info(
            { ruleId: rule.id, action, phone },
            `Routing rule "${rule.name}" matched`
          );
          if (action.type === "reject" || action.type === "block") {
            return { shortCircuit: true, reason: rule.name, tag: action.tag };
          }
          if (action.type === "tag") {
            (payload as any).appliedTag = action.tag;
          }
          // queue/transfer/vip_alert -> nao curto-circuita, deixa o IVR/agent
        }
      } catch (e) {
        logger.warn({ err: e, ruleId: rule.id }, "Bad routing rule JSON");
      }
    }
    return { shortCircuit: false };
  } catch (e) {
    logger.warn({ err: e }, "Routing eval failed - continuing pipeline");
    return { shortCircuit: false };
  }
}

function matchCondition(
  cond: any,
  ctx: { phone: string; recentCount: number; tag?: string }
): boolean {
  if (!cond || typeof cond !== "object") return false;
  if (cond.type === "vip") return ctx.tag === "vip";
  if (cond.type === "blocked") return ctx.tag === "blocked";
  if (cond.type === "tag") return ctx.tag === cond.value;
  if (cond.type === "repeat") {
    const min = Number(cond.minCalls ?? 3);
    return ctx.recentCount >= min;
  }
  if (cond.type === "ddd") {
    const prefix = String(cond.value ?? "");
    return ctx.phone.startsWith(prefix);
  }
  if (cond.type === "phone_match") {
    const pat = String(cond.value ?? "");
    try {
      return new RegExp(pat).test(ctx.phone);
    } catch {
      return false;
    }
  }
  return false;
}
