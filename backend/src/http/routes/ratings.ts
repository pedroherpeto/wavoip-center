/**
 * /ratings - resultados da pesquisa NPS.
 *
 *  GET /ratings           lista todas com paginacao
 *  GET /ratings/summary   NPS atual + breakdown
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";

export async function ratingsRoutes(app: FastifyInstance) {
  app.get("/ratings", async (req) => {
    const limit = Number((req.query as any)?.limit ?? 50);
    const offset = Number((req.query as any)?.offset ?? 0);
    const [items, count] = await Promise.all([
      prisma.callRating.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      prisma.callRating.count(),
    ]);
    return { items, count, limit, offset };
  });

  app.get("/ratings/summary", async () => {
    const all = await prisma.callRating.findMany({
      select: { score: true, createdAt: true },
    });
    const total = all.length;
    if (total === 0) {
      return { total: 0, nps: 0, promoters: 0, neutrals: 0, detractors: 0 };
    }
    let promoters = 0,
      detractors = 0,
      neutrals = 0;
    let sum = 0;
    for (const r of all) {
      sum += r.score;
      if (r.score >= 9) promoters++;
      else if (r.score >= 7) neutrals++;
      else detractors++;
    }
    const nps = Math.round((promoters / total - detractors / total) * 100);
    return {
      total,
      nps,
      avg: Number((sum / total).toFixed(2)),
      promoters,
      neutrals,
      detractors,
      promoterPct: Number(((promoters / total) * 100).toFixed(1)),
      neutralPct: Number(((neutrals / total) * 100).toFixed(1)),
      detractorPct: Number(((detractors / total) * 100).toFixed(1)),
    };
  });
}
