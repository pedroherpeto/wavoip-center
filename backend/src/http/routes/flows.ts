import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/client";
import { NotFoundError } from "../../utils/errors";

const FlowSchema = z.object({
  name: z.string().min(1),
  sessionId: z.number().int().optional(),
  trigger: z.enum(["incoming_call", "missed_call", "outside_hours", "manual"]),
  locale: z.enum(["pt-BR", "en-US"]).default("pt-BR"),
  steps: z.array(z.any()).min(1),
  active: z.boolean().default(true),
});

export async function flowRoutes(app: FastifyInstance) {
  app.get("/flows", async (req) => {
    const sessionId = (req.query as any)?.sessionId
      ? Number((req.query as any).sessionId)
      : undefined;
    return prisma.flow.findMany({
      where: sessionId ? { sessionId } : {},
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/flows/:id", async (req) => {
    const id = Number((req.params as any).id);
    const flow = await prisma.flow.findUnique({ where: { id } });
    if (!flow) throw new NotFoundError("Flow");
    return flow;
  });

  app.post("/flows", async (req) => {
    const body = FlowSchema.parse((req as any).body);
    return prisma.flow.create({
      data: {
        name: body.name,
        sessionId: body.sessionId,
        trigger: body.trigger,
        locale: body.locale,
        steps: JSON.stringify(body.steps),
        active: body.active,
      },
    });
  });

  app.put("/flows/:id", async (req) => {
    const id = Number((req.params as any).id);
    const body = FlowSchema.partial().parse((req as any).body);
    const data: any = { ...body };
    if (body.steps) data.steps = JSON.stringify(body.steps);
    return prisma.flow.update({ where: { id }, data });
  });

  app.delete("/flows/:id", async (req) => {
    const id = Number((req.params as any).id);
    await prisma.flow.delete({ where: { id } });
    return { ok: true };
  });
}
