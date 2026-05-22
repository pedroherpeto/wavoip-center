/**
 * /timeline - eventos unificados de um contato (chamadas + ratings + tags +
 * eventos de chamada). Permite ver toda a interacao com um numero numa lista
 * ordenada por timestamp.
 *
 *  GET /timeline?phone=553598828503&limit=100
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

type TimelineEntry = {
  type: "call" | "rating" | "tag" | "callback" | "event";
  at: string;
  data: any;
};

export async function timelineRoutes(app: FastifyInstance) {
  app.get("/timeline", async (req) => {
    const phoneRaw = String((req.query as any)?.phone ?? "").replace(/\D/g, "");
    if (!phoneRaw) {
      return { error: "phone query param required", items: [] };
    }
    const limit = Math.min(Number((req.query as any)?.limit ?? 100), 500);

    const [calls, ratings, tag, callbacks] = await Promise.all([
      prisma.call.findMany({
        where: { fromNumber: phoneRaw },
        orderBy: { startedAt: "desc" },
        take: limit,
        include: {
          events: { orderBy: { createdAt: "desc" } },
          session: { select: { name: true, number: true } },
        },
      }),
      prisma.callRating.findMany({
        where: { phone: phoneRaw },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.contactTag.findUnique({ where: { phone: phoneRaw } }),
      prisma.callback.findMany({
        where: { phone: phoneRaw },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    const entries: TimelineEntry[] = [];

    for (const c of calls) {
      entries.push({
        type: "call",
        at: c.startedAt.toISOString(),
        data: {
          id: c.id,
          direction: c.direction,
          status: c.status,
          durationSec: c.durationSec,
          session: c.session,
          endedAt: c.endedAt,
        },
      });
      for (const ev of c.events) {
        entries.push({
          type: "event",
          at: ev.createdAt.toISOString(),
          data: { callId: c.id, type: ev.type, payload: ev.payload },
        });
      }
    }
    for (const r of ratings) {
      entries.push({
        type: "rating",
        at: r.createdAt.toISOString(),
        data: { callId: r.callId, score: r.score, comment: r.comment },
      });
    }
    if (tag) {
      entries.push({
        type: "tag",
        at: tag.createdAt.toISOString(),
        data: { tag: tag.tag, reason: tag.reason },
      });
    }
    for (const cb of callbacks) {
      entries.push({
        type: "callback",
        at: cb.createdAt.toISOString(),
        data: {
          id: cb.id,
          status: cb.status,
          reason: cb.reason,
          scheduledAt: cb.scheduledAt,
          completedAt: cb.completedAt,
        },
      });
    }

    entries.sort((a, b) => (a.at < b.at ? 1 : -1));

    // Calcula estatisticas resumidas
    const stats = {
      totalCalls: calls.length,
      completedCalls: calls.filter(
        (c) => c.status === "completed" || c.status === "answered"
      ).length,
      missedCalls: calls.filter((c) => c.status === "missed").length,
      avgRating:
        ratings.length > 0
          ? Number(
              (
                ratings.reduce((s, r) => s + r.score, 0) / ratings.length
              ).toFixed(1)
            )
          : null,
      currentTag: tag?.tag ?? null,
    };

    return {
      phone: phoneRaw,
      stats,
      items: entries.slice(0, limit),
    };
  });
}
