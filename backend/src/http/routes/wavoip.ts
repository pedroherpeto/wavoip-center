/**
 * Rotas /wavoip/* - expoem dados da API Wavoip (devices + calls) e
 * controle do poller.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client";
import { fetchDevices, fetchCallsByToken } from "../../wavoip/client";
import {
  startWavoipPoller,
  stopWavoipPoller,
  isPollerRunning,
} from "../../wavoip/poller";

async function tokensForSession(sessionId?: number): Promise<string[]> {
  const where = sessionId ? { id: sessionId } : { NOT: { wavoipTokens: null } };
  const sessions = await prisma.session.findMany({
    where,
    select: { id: true, wavoipTokens: true },
  });
  const all = new Set<string>();
  for (const s of sessions) {
    (s.wavoipTokens ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => all.add(t));
  }
  return Array.from(all);
}

export async function wavoipRoutes(app: FastifyInstance) {
  app.get("/wavoip/devices", async (req) => {
    const sessionId = (req.query as any)?.sessionId
      ? Number((req.query as any).sessionId)
      : undefined;
    const tokens = await tokensForSession(sessionId);
    const results: any[] = [];
    for (const token of tokens) {
      const devices = await fetchDevices(token);
      results.push({ token: token.slice(0, 8) + "...", devices });
    }
    return { items: results, count: results.length };
  });

  app.get("/wavoip/calls", async (req) => {
    const sessionId = (req.query as any)?.sessionId
      ? Number((req.query as any).sessionId)
      : undefined;
    const tokens = await tokensForSession(sessionId);
    const results: any[] = [];
    for (const token of tokens) {
      const calls = await fetchCallsByToken(token);
      results.push({ token: token.slice(0, 8) + "...", calls });
    }
    return { items: results, count: results.length };
  });

  app.get("/wavoip/poller", async () => ({ running: isPollerRunning() }));

  app.post("/wavoip/poller/start", async () => {
    startWavoipPoller();
    return { ok: true, running: isPollerRunning() };
  });

  app.post("/wavoip/poller/stop", async () => {
    stopWavoipPoller();
    return { ok: true, running: isPollerRunning() };
  });
}
