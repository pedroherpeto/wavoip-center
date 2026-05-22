/**
 * Message listener para captar input do usuario durante IVR.
 *
 * Espelha o padrao wbotsMessageListenerZPRO.ts mas simplificado:
 * - so nos interessa mensagens de texto (1-N) durante IVR ativo
 * - notify mode (mensagens novas, nao historico)
 */

import { baileysLogger as logger } from "../utils/logger";
import { eventBus } from "../pabx/eventBus";
import { prisma } from "../db/client";

type WASocket = any;

function extractTextBody(msg: any): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    null
  );
}

export function attachMessageListener(wbot: WASocket, sessionId: number): void {
  wbot.ev.on("messages.upsert", async ({ messages, type }: any) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.key || msg.key.fromMe) continue;
        const remoteJid: string = msg.key.remoteJid || "";
        if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) continue;

        const text = extractTextBody(msg);
        if (!text) continue;

        const phone = remoteJid.split("@")[0].split(":")[0];

        // Verifica se ha uma chamada em estado IVR ativo para esse numero
        const activeCall = await prisma.call.findFirst({
          where: {
            sessionId,
            fromNumber: phone,
            status: "in_ivr",
          },
          orderBy: { startedAt: "desc" },
        });

        if (activeCall) {
          logger.debug(
            { sessionId, phone, text, callId: activeCall.id },
            "Routing message to IVR engine"
          );
          eventBus.emit("ivr.input", {
            sessionId,
            callId: activeCall.id,
            from: phone,
            input: text.trim(),
            timestamp: Date.now(),
          });
        }
      } catch (e) {
        logger.error({ err: e, sessionId }, "Error processing message");
      }
    }
  });
}
