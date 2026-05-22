/**
 * /blacklist e /routing-rules CRUD.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { NotFoundError } from "../../utils/errors";

const BlacklistSchema = z.object({
  phone: z.string().min(5),
  tag: z.enum(["blocked", "vip", "trusted"]).default("blocked"),
  reason: z.string().optional(),
});

const RuleSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().default(100),
  condition: z.record(z.string(), z.any()),
  action: z.record(z.string(), z.any()),
  active: z.boolean().default(true),
});

export async function routingRoutes(app: FastifyInstance) {
  // ============ CONTACT TAGS (blacklist/VIP/trusted) ============
  app.get("/contact-tags", async (req) => {
    const tag = (req.query as any)?.tag as string | undefined;
    const items = await prisma.contactTag.findMany({
      where: tag ? { tag } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return { items };
  });

  app.post("/contact-tags", async (req) => {
    const body = BlacklistSchema.parse((req as any).body);
    const phone = body.phone.replace(/\D/g, "");
    const created = await prisma.contactTag.upsert({
      where: { phone },
      create: { phone, tag: body.tag, reason: body.reason },
      update: { tag: body.tag, reason: body.reason },
    });
    return created;
  });

  app.delete("/contact-tags/:phone", async (req) => {
    const phone = String((req.params as any).phone).replace(/\D/g, "");
    await prisma.contactTag.delete({ where: { phone } }).catch(() => undefined);
    return { ok: true };
  });

  // Atalhos
  app.post("/blacklist/:phone", async (req) => {
    const phone = String((req.params as any).phone).replace(/\D/g, "");
    const reason = ((req.body as any)?.reason as string) ?? "manual";
    const created = await prisma.contactTag.upsert({
      where: { phone },
      create: { phone, tag: "blocked", reason },
      update: { tag: "blocked", reason },
    });
    return created;
  });

  app.post("/vip/:phone", async (req) => {
    const phone = String((req.params as any).phone).replace(/\D/g, "");
    const reason = ((req.body as any)?.reason as string) ?? "manual";
    const created = await prisma.contactTag.upsert({
      where: { phone },
      create: { phone, tag: "vip", reason },
      update: { tag: "vip", reason },
    });
    return created;
  });

  // ============ ROUTING RULES ============
  app.get("/routing-rules", async () => {
    const items = await prisma.routingRule.findMany({
      orderBy: [{ active: "desc" }, { priority: "asc" }],
    });
    return {
      items: items.map((r) => ({
        ...r,
        condition: JSON.parse(r.condition),
        action: JSON.parse(r.action),
      })),
    };
  });

  app.post("/routing-rules", async (req) => {
    const body = RuleSchema.parse((req as any).body);
    const created = await prisma.routingRule.create({
      data: {
        name: body.name,
        priority: body.priority,
        condition: JSON.stringify(body.condition),
        action: JSON.stringify(body.action),
        active: body.active,
      },
    });
    return created;
  });

  app.put("/routing-rules/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = RuleSchema.partial().parse((req as any).body);
    const existing = await prisma.routingRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("RoutingRule");
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.active !== undefined) data.active = body.active;
    if (body.condition !== undefined)
      data.condition = JSON.stringify(body.condition);
    if (body.action !== undefined) data.action = JSON.stringify(body.action);
    const updated = await prisma.routingRule.update({ where: { id }, data });
    return updated;
  });

  app.delete("/routing-rules/:id", async (req) => {
    const id = Number((req.params as any).id);
    await prisma.routingRule.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  });
}
