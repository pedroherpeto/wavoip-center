/**
 * Rotas /business-hours - CRUD de horario comercial.
 *
 * Modelo BusinessHours tem 1 linha por dia da semana (0=Dom..6=Sab),
 * com openTime/closeTime no formato "HH:MM" e flag active.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { NotFoundError } from "../../utils/errors";

const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const UpsertSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(TimeRegex, "Use HH:MM"),
  closeTime: z.string().regex(TimeRegex, "Use HH:MM"),
  active: z.boolean().optional(),
});

const UpdateSchema = z.object({
  openTime: z.string().regex(TimeRegex).optional(),
  closeTime: z.string().regex(TimeRegex).optional(),
  active: z.boolean().optional(),
});

export async function businessHoursRoutes(app: FastifyInstance) {
  app.get("/business-hours", async () => {
    const items = await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: "asc" },
    });
    return { items };
  });

  app.post("/business-hours", async (req) => {
    const body = UpsertSchema.parse((req as any).body);
    const created = await prisma.businessHours.create({
      data: {
        dayOfWeek: body.dayOfWeek,
        openTime: body.openTime,
        closeTime: body.closeTime,
        active: body.active ?? true,
      },
    });
    return created;
  });

  app.put("/business-hours/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = UpdateSchema.parse((req as any).body);
    const existing = await prisma.businessHours.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("BusinessHours");
    const updated = await prisma.businessHours.update({
      where: { id },
      data: body,
    });
    return updated;
  });

  app.delete("/business-hours/:id", async (req) => {
    const id = Number((req.params as any).id);
    await prisma.businessHours.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  });
}
