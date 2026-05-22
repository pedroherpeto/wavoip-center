/**
 * Monitor de chamadas via Baileys v7.
 *
 * Estrategia primaria: usar evento `call` do EventEmitter de Baileys v7
 * (signature: wbot.ev.on("call", calls => ...)) — limpo e tipado.
 *
 * Estrategia secundaria/fallback: escutar evento bruto `CB:call` no socket
 * binario (padrao do zpro-passaporte/backend/src/services/WbotBaileysServices/wbotsmonitorZPRO.ts:47).
 * Util para capturar terminate/relaylatency que nao chegam no evento de alto nivel.
 */

import { baileysLogger as logger } from "../utils/logger";
import { eventBus } from "../pabx/eventBus";

type WASocket = any;

export function attachCallMonitor(wbot: WASocket, sessionId: number): void {
  // === Camada 1: evento "call" de alto nivel (Baileys v7) ===
  wbot.ev.on("call", (calls: any[]) => {
    for (const call of calls) {
      // Baileys v7 com Multi-Device manda call.from como @lid (linked device
      // identifier interno). O numero WhatsApp REAL vem em call.callerPn ou
      // call.peerJid. So caimos pra call.from/chatId como ultimo recurso.
      const rawJid =
        call.callerPn ||
        call.peerJid ||
        call.from ||
        call.chatId ||
        "";
      const callId = call.id;
      const status = String(call.status || "").toLowerCase();
      // Extrai numero E.164 do JID (formato: NUMBER:DEVICE@DOMAIN)
      const phone = String(rawJid).split("@")[0].split(":")[0];

      logger.info(
        {
          sessionId,
          callId,
          from: phone,
          rawJid,
          status,
          isVideo: call.isVideo,
          isGroup: call.isGroup,
        },
        "Call event (high-level)"
      );

      // Usa o JID real (s.whatsapp.net) quando possivel, senao reconstroi
      const jid = rawJid.includes("@s.whatsapp.net")
        ? rawJid
        : `${phone}@s.whatsapp.net`;

      const basePayload = {
        sessionId,
        whatsappCallId: callId,
        from: phone,
        jid,
        direction: "incoming" as const,
        timestamp: Date.now(),
        raw: call,
      };

      if (status === "offer" || status === "ringing") {
        eventBus.emit("call.incoming", basePayload);
      } else if (status === "accept") {
        eventBus.emit("call.accepted", basePayload);
      } else if (status === "reject") {
        eventBus.emit("call.rejected", { ...basePayload, reason: "rejected" });
      } else if (status === "timeout") {
        eventBus.emit("call.missed", { ...basePayload, reason: "missed" });
      } else if (status === "terminate") {
        eventBus.emit("call.terminated", { ...basePayload, reason: "terminated" });
      }
    }
  });

  // === Camada 2: socket binario (fallback / detalhes brutos) ===
  // Espelha o padrao do wbotsmonitorZPRO.ts:47
  try {
    wbot.ws?.on?.("CB:call", (node: any) => {
      if (!node?.content) return;
      const content = Array.isArray(node.content) ? node.content[0] : node.content;
      const tag = content?.tag;
      const from = node?.attrs?.from || "";
      const phone = String(from).split("@")[0].split(":")[0];
      const callId = content?.attrs?.["call-id"] || node?.attrs?.id || "";

      logger.debug(
        { sessionId, tag, from: phone, callId },
        "CB:call raw socket event"
      );

      // Bailey v7 ja emite "call" para offer/accept/reject/terminate.
      // Aqui logamos detalhes adicionais (relaylatency, audio_stream, etc.)
      // sem duplicar eventos no bus.
    });
  } catch (e) {
    logger.debug({ err: e }, "CB:call binding skipped");
  }
}
