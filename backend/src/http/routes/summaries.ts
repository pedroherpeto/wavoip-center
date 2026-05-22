/**
 * /calls/:id/summary - resumo IA gerado pos-chamada.
 *
 * GET retorna transcript + summary (se ja gerado).
 * POST forca regeracao.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { NotFoundError } from "../../utils/errors";

export async function summariesRoutes(app: FastifyInstance) {
  app.get("/calls/:id/summary", async (req) => {
    const id = Number((req.params as any).id);
    const summary = await prisma.callSummary.findUnique({ where: { callId: id } });
    if (!summary) throw new NotFoundError("CallSummary");
    return summary;
  });

  app.get("/summaries", async (req) => {
    const limit = Math.min(Number((req.query as any)?.limit ?? 50), 200);
    const items = await prisma.callSummary.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { items, count: items.length };
  });
}
