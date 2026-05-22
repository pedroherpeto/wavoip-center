import { Server as IOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { eventBus } from "../pabx/eventBus";
import { httpLogger as logger } from "../utils/logger";
import { config } from "../config";

let io: IOServer | null = null;

export function initSocket(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(","),
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");
    socket.on("disconnect", () => logger.debug({ socketId: socket.id }, "Socket disconnected"));
  });

  // Bridge eventBus -> socket.io
  eventBus.on("session.status", (p) => io?.emit("session.status", p));
  // Emite call.incoming pra UI APOS o callLogger ter persistido a Call
  // (assim o payload ja tem callId / callDbId pra reject/end APIs)
  eventBus.on("call.persisted", (p) =>
    io?.emit("call.incoming", { ...p, callDbId: p.callId })
  );
  eventBus.on("call.accepted", (p) => io?.emit("call.accepted", p));
  eventBus.on("call.rejected", (p) => io?.emit("call.rejected", p));
  eventBus.on("call.missed", (p) => io?.emit("call.missed", p));
  eventBus.on("call.terminated", (p) => io?.emit("call.terminated", p));

  logger.info("Socket.IO initialized");
  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
