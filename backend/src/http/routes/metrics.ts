/**
 * Rotas /metrics - estatisticas operacionais do PABX.
 *
 *  GET /metrics                snapshot atual (hoje, ultima hora, ultimas 24h)
 *  GET /metrics/sessions       status de cada sessao + tokens registrados
 *  GET /metrics/calls-by-day   serie temporal por dia (ultimos 30 dias)
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { listActiveSessions } from "../../baileys/sessionManager";
import { isPollerRunning } from "../../wavoip/poller";

function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function aggregate(since: Date) {
  const calls = await prisma.call.findMany({
    where: { startedAt: { gte: since } },
    select: { status: true, direction: true, durationSec: true },
  });
  const total = calls.length;
  const byStatus: Record<string, number> = {};
  const byDirection: Record<string, number> = {};
  let totalDurationSec = 0;
  let withDuration = 0;

  for (const c of calls) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byDirection[c.direction] = (byDirection[c.direction] || 0) + 1;
    if (c.durationSec && c.durationSec > 0) {
      totalDurationSec += c.durationSec;
      withDuration++;
    }
  }

  const answered = byStatus["answered"] || 0;
  const completed = byStatus["completed"] || 0;
  const rejected = byStatus["rejected"] || 0;
  const missed = byStatus["missed"] || 0;
  const handled = answered + completed;
  const answerRate = total > 0 ? handled / total : 0;
  const avgDurationSec =
    withDuration > 0 ? Math.round(totalDurationSec / withDuration) : 0;

  return {
    total,
    handled,
    rejected,
    missed,
    answerRate: Number(answerRate.toFixed(3)),
    avgDurationSec,
    byStatus,
    byDirection,
  };
}

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async () => {
    const now = new Date();
    const today = startOfDay(now);
    const hour1Ago = new Date(now.getTime() - 60 * 60 * 1000);
    const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [todayStats, lastHour, last24h, sessionsCount, callbacksPending] =
      await Promise.all([
        aggregate(today),
        aggregate(hour1Ago),
        aggregate(h24Ago),
        prisma.session.count({ where: { isActive: true } }),
        prisma.callback.count({ where: { status: "pending" } }),
      ]);

    const sessionsConnected = listActiveSessions().length;
    const callsPerMinLastHour = Number(
      (lastHour.total / 60).toFixed(2)
    );

    return {
      generatedAt: now.toISOString(),
      runtime: {
        sessionsActive: sessionsCount,
        sessionsConnected,
        wavoipPollerRunning: isPollerRunning(),
        callbacksPending,
      },
      today: todayStats,
      lastHour: { ...lastHour, callsPerMin: callsPerMinLastHour },
      last24h,
    };
  });

  app.get("/metrics/sessions", async () => {
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        name: true,
        number: true,
        status: true,
        wavoipTokens: true,
        ivrEnabled: true,
        rejectCalls: true,
        isActive: true,
      },
    });
    const active = new Set(listActiveSessions());
    return {
      items: sessions.map((s) => ({
        ...s,
        tokensCount: (s.wavoipTokens ?? "")
          .split(",")
          .filter((t) => t.trim()).length,
        wavoipTokens: undefined,
        wbotActive: active.has(s.id),
      })),
    };
  });

  app.get("/metrics/calls-by-day", async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const calls = await prisma.call.findMany({
      where: { startedAt: { gte: since } },
      select: { startedAt: true, status: true, durationSec: true },
      orderBy: { startedAt: "asc" },
    });

    const byDay: Record<string, { total: number; handled: number; missed: number; durationSum: number; durationCount: number }> = {};
    for (const c of calls) {
      const key = c.startedAt.toISOString().slice(0, 10);
      byDay[key] = byDay[key] || {
        total: 0,
        handled: 0,
        missed: 0,
        durationSum: 0,
        durationCount: 0,
      };
      byDay[key].total++;
      if (c.status === "answered" || c.status === "completed")
        byDay[key].handled++;
      if (c.status === "missed") byDay[key].missed++;
      if (c.durationSec && c.durationSec > 0) {
        byDay[key].durationSum += c.durationSec;
        byDay[key].durationCount++;
      }
    }

    return {
      items: Object.entries(byDay).map(([day, v]) => ({
        day,
        total: v.total,
        handled: v.handled,
        missed: v.missed,
        avgDurationSec:
          v.durationCount > 0 ? Math.round(v.durationSum / v.durationCount) : 0,
      })),
    };
  });
}
