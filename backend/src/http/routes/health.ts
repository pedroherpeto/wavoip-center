import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { listActiveSessions } from "../../baileys/sessionManager";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/health/deep", async () => {
    let db = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e: any) {
      db = `error: ${e?.message}`;
    }
    return {
      status: db === "ok" ? "ok" : "degraded",
      db,
      activeSessions: listActiveSessions(),
      timestamp: new Date().toISOString(),
    };
  });
}
