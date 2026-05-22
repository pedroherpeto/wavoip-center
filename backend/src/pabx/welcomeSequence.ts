/**
 * Welcome sequence - sequencia configuravel de mensagens (texto + audio
 * + imagem) enviadas ao receber uma chamada.
 *
 * Stored em Session.welcomeSequence como JSON array de:
 *  { type: "text"  , text: string }
 *  { type: "audio" , audioUrl: string, caption?: string }   // mp3/ogg/m4a
 *  { type: "image" , imageUrl: string, caption?: string }
 *
 * Todos os steps aceitam delayMs opcional para pausa antes de enviar
 * (default 800ms entre mensagens). Se welcomeSequence for null/vazio,
 * faz fallback ao callRejectMessage da sessao ou ao default global do
 * .env / settings.
 */

import { t, type Locale } from "./compat";
import { pabxLogger as logger } from "../utils/logger";
import { prisma } from "../db/client";

type WASocket = any;

export interface WelcomeStep {
  type: "text" | "audio" | "image";
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  caption?: string;
  delayMs?: number;
  /**
   * Quando true em step "audio": este audio NAO eh enviado como mensagem
   * WhatsApp - serve apenas como URA injetada na chamada quando o agente
   * atender (frontend faz mix via Web Audio API).
   */
  injectOnAnswer?: boolean;
}

function parseSequence(raw: string | null): WelcomeStep[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: any) =>
        s &&
        typeof s === "object" &&
        (s.type === "text" || s.type === "audio" || s.type === "image")
    );
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendStep(
  wbot: WASocket,
  jid: string,
  step: WelcomeStep
): Promise<void> {
  if (step.type === "text") {
    if (!step.text) return;
    await wbot.sendMessage(jid, { text: step.text });
    return;
  }
  if (step.type === "audio") {
    if (!step.audioUrl) return;
    await wbot.sendMessage(jid, {
      audio: { url: step.audioUrl },
      mimetype: "audio/mpeg",
      ptt: false,
    });
    return;
  }
  if (step.type === "image") {
    if (!step.imageUrl) return;
    await wbot.sendMessage(jid, {
      image: { url: step.imageUrl },
      caption: step.caption,
    });
    return;
  }
}

export async function sendWelcomeSequence(
  wbot: WASocket,
  jid: string,
  session: { id: number; locale: string; callRejectMessage: string | null; welcomeSequence: string | null },
  locale: Locale
): Promise<void> {
  const steps = parseSequence(session.welcomeSequence);

  if (steps.length === 0) {
    // Fallback: single text usando callRejectMessage ou default global
    const text = session.callRejectMessage?.trim() || t("call.reject.default", locale);
    await wbot.sendMessage(jid, { text });
    return;
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    // Audio com injectOnAnswer NAO eh enviado como mensagem
    // (sera tocado pelo frontend na chamada ao atender)
    if (step.type === "audio" && step.injectOnAnswer) {
      logger.debug(
        { sessionId: session.id, step: i },
        "welcome step skipped (injectOnAnswer)"
      );
      continue;
    }
    if (i > 0) {
      const delay = step.delayMs ?? 800;
      if (delay > 0) await sleep(delay);
    }
    try {
      await sendStep(wbot, jid, step);
      logger.debug({ sessionId: session.id, step: i, type: step.type }, "welcome step sent");
    } catch (e) {
      logger.warn({ err: e, sessionId: session.id, step: i }, "welcome step failed");
    }
  }
}

// Backward compat helper para callers que queiram resolver a sequencia sem session
export async function getSessionWelcomeSteps(sessionId: number): Promise<WelcomeStep[]> {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { welcomeSequence: true },
  });
  return parseSequence(s?.welcomeSequence ?? null);
}
