/**
 * Rotas /callbacks - fila de retornos de chamadas.
 *
 *  GET  /callbacks           lista (filtros: status, sessionId)
 *  POST /callbacks           cria novo callback
 *  PUT  /callbacks/:id       atualiza status (pending|done|cancelled)
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { NotFoundError } from "../../utils/errors";

const CreateSchema = z.object({
  sessionId: z.number().int().positive(),
  phone: z.string().min(5),
  reason: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

const UpdateSchema = z.object({
  status: z.enum(["pending", "done", "cancelled"]).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
});

const ListQuery = z.object({
  status: z.enum(["pending", "done", "cancelled"]).optional(),
  sessionId: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function callbacksRoutes(app: FastifyInstance) {
  app.get("/callbacks", async (req) => {
    const q = ListQuery.parse((req as any).query);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.sessionId) where.sessionId = q.sessionId;
    const [items, count] = await Promise.all([
      prisma.callback.findMany({
        where,
        orderBy: [{ status: "asc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
        skip: q.offset,
        take: q.limit,
      }),
      prisma.callback.count({ where }),
    ]);
    return { items, count, limit: q.limit, offset: q.offset };
  });

  app.post("/callbacks", async (req) => {
    const body = CreateSchema.parse((req as any).body);
    const created = await prisma.callback.create({
      data: {
        sessionId: body.sessionId,
        phone: body.phone.replace(/\D/g, ""),
        reason: body.reason ?? "manual",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });
    return created;
  });

  app.put("/callbacks/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = UpdateSchema.parse((req as any).body);
    const existing = await prisma.callback.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Callback");
    const updated = await prisma.callback.update({
      where: { id },
      data: {
        ...body,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : body.scheduledAt,
        completedAt:
          body.status === "done"
            ? new Date()
            : body.completedAt
              ? new Date(body.completedAt)
              : body.completedAt,
      },
    });
    return updated;
  });

  app.delete("/callbacks/:id", async (req) => {
    const id = Number((req.params as any).id);
    await prisma.callback.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  });
}
