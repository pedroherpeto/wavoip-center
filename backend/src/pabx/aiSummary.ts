/**
 * Resumo IA pos-chamada (Fase 7).
 *
 * Fluxo (quando setting `ai_summary_enabled` = true):
 *  1. call.terminated com status=completed && durationSec > 30
 *  2. Tenta baixar gravacao da Wavoip API (depende do token + endpoint)
 *  3. Transcreve via OpenAI Whisper
 *  4. Sumariza via Anthropic Claude (Haiku 4.5)
 *  5. Persiste em CallSummary
 *  6. Opcionalmente envia resumo ao cliente por WhatsApp
 *
 * Requer:
 *  - OPENAI_API_KEY no .env (Whisper)
 *  - ANTHROPIC_API_KEY no .env (Claude)
 *
 * Notas:
 *  - O endpoint exato da Wavoip pra baixar gravacao depende da conta. Por
 *    padrao tentamos GET /calls/:wavoipCallId/recording. Se nao existir,
 *    pula a transcricao.
 *  - Custo aproximado: $0.006/min (Whisper) + ~$0.001/chamada (Claude Haiku)
 */

import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../db/client";
import { eventBus } from "./eventBus";
import { getSession } from "../baileys/sessionManager";
import { pabxLogger as logger } from "../utils/logger";
import { config } from "../config";
import { getSettingSync } from "./settings";

const log = logger.child({ module: "ai-summary" });

function openaiKey(): string {
  const k = String(getSettingSync("openai_api_key" as any) || "").trim();
  return k || config.OPENAI_API_KEY || "";
}
function whisperModel(): string {
  return (
    String(getSettingSync("openai_whisper_model" as any) || "").trim() ||
    config.OPENAI_WHISPER_MODEL
  );
}
function anthropicKey(): string {
  const k = String(getSettingSync("anthropic_api_key" as any) || "").trim();
  return k || config.ANTHROPIC_API_KEY || "";
}
function anthropicModel(): string {
  return (
    String(getSettingSync("anthropic_model" as any) || "").trim() ||
    config.ANTHROPIC_MODEL
  );
}
function openaiSummaryModel(): string {
  return (
    String(getSettingSync("openai_summary_model" as any) || "").trim() ||
    "gpt-4o-mini"
  );
}
// Resolve qual provider usar pra sumarizacao
function summaryProvider(): "openai" | "anthropic" | "none" {
  const setting = String(
    getSettingSync("ai_summary_provider" as any) || "auto"
  ).toLowerCase();
  const hasOA = !!openaiKey();
  const hasAN = !!anthropicKey();
  if (setting === "openai") return hasOA ? "openai" : "none";
  if (setting === "anthropic") return hasAN ? "anthropic" : "none";
  // auto: anthropic preferido (mais barato/melhor pra resumo curto), senao openai
  if (hasAN) return "anthropic";
  if (hasOA) return "openai";
  return "none";
}

// Dedup global (sobrevive a hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __pabxAiSummaryProcessed: Set<number> | undefined;
}
const processed: Set<number> =
  globalThis.__pabxAiSummaryProcessed ?? new Set();
globalThis.__pabxAiSummaryProcessed = processed;

async function maybeProcess(payload: any, source: string) {
  try {
    if (!getSettingSync("ai_summary_enabled" as any)) return;
    if (!payload.callId) return;
    if (!openaiKey()) {
      log.debug({ callId: payload.callId }, "OPENAI api key ausente - pulando");
      return;
    }
    const minDuration = Number(
      getSettingSync("ai_summary_min_duration_seconds" as any) ?? 30
    );
    if (minDuration > 0) {
      if (!payload.durationSec || payload.durationSec < minDuration) {
        log.debug(
          { callId: payload.callId, duration: payload.durationSec, minDuration },
          "AI summary skipped - duration below threshold"
        );
        return;
      }
    }

    // Permite reprocessar quando vem do recording upload (forca retry mesmo
    // se ja tentou e falhou por falta de gravacao)
    if (processed.has(payload.callId) && source !== "recording") {
      log.debug(
        { callId: payload.callId, source },
        "AI summary already processed - skipping"
      );
      return;
    }
    processed.add(payload.callId);

    log.info(
      { callId: payload.callId, source },
      "AI summary scheduled"
    );
    processSummary(payload.callId).catch((e) => {
      processed.delete(payload.callId);
      log.error({ err: e, callId: payload.callId }, "summary processing failed");
    });
  } catch (e) {
    log.warn({ err: e }, "ai summary trigger failed");
  }
}

eventBus.on("call.completed" as any, (p: any) => maybeProcess(p, "completed"));
eventBus.on("call.recording.uploaded" as any, (p: any) =>
  maybeProcess(p, "recording")
);

async function processSummary(callId: number): Promise<void> {
  const t0 = Date.now();
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { session: true },
  });
  if (!call) return;
  log.info({ callId }, "Starting AI summary processing");

  // 1. Tenta primeiro a gravacao client-side (capturada pelo widget)
  let recording = await tryReadLocalRecording(callId);
  if (!recording) {
    // 2. Fallback: gravacao da Wavoip API
    recording = await tryDownloadRecording(call);
  }
  if (!recording) {
    log.warn({ callId }, "Recording unavailable - skipping summary");
    return;
  }

  // 2. Transcreve via Whisper
  const transcript = await transcribeAudio(recording.buffer, recording.filename);
  if (!transcript) {
    log.warn({ callId }, "Transcription failed");
    return;
  }
  log.info({ callId, length: transcript.length }, "Transcribed");

  // 3. Sumariza via provider escolhido (anthropic/openai/auto)
  let summary: string | null = null;
  const provider = summaryProvider();
  log.info({ callId, provider }, "Summary provider selected");
  if (provider === "anthropic") {
    summary = await summarizeWithClaude(transcript);
  } else if (provider === "openai") {
    summary = await summarizeWithOpenAI(transcript);
  } else {
    log.debug({ callId }, "Nenhum provider de sumarizacao disponivel - salvando apenas transcript");
  }

  // 4. Persiste
  const durationMs = Date.now() - t0;
  await prisma.callSummary.upsert({
    where: { callId },
    create: { callId, transcript, summary, durationMs },
    update: { transcript, summary, durationMs },
  });
  log.info({ callId, durationMs, hasSummary: !!summary }, "Summary saved");

  // 5. Opcionalmente envia ao cliente
  if (summary && getSettingSync("ai_summary_send_to_client" as any)) {
    const wbot = getSession(call.sessionId);
    if (wbot) {
      const jid = `${call.fromNumber}@s.whatsapp.net`;
      const text = `*Resumo da nossa ligação*\n\n${summary}`;
      try {
        await wbot.sendMessage(jid, { text });
        log.info({ callId }, "Summary sent to client");
      } catch (e) {
        log.warn({ err: e, callId }, "Failed to send summary");
      }
    }
  }
}

async function tryReadLocalRecording(
  callId: number
): Promise<{ buffer: Buffer; filename: string } | null> {
  try {
    const summary = await prisma.callSummary.findUnique({ where: { callId } });
    if (!summary?.recordingUrl) return null;
    // recordingUrl eh tipo http://host:3001/media/recordings/<file>
    // Extrai apenas o nome do arquivo final, decodificando %xx
    const lastSegment = summary.recordingUrl.split("/").pop() ?? "";
    const filename = decodeURIComponent(lastSegment);
    if (!filename) return null;
    const filePath = path.resolve(
      process.cwd(),
      ".uploads",
      "recordings",
      filename
    );
    const buffer = await fs.readFile(filePath);
    log.info({ callId, size: buffer.length, filename }, "Using client-side recording");
    return { buffer, filename };
  } catch (e) {
    log.debug({ err: e, callId }, "local recording read failed");
    return null;
  }
}

async function tryDownloadRecording(
  call: any
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (!call.session?.wavoipTokens) return null;
  if (!call.wavoipCallId && !call.whatsappCallId) return null;

  const token = call.session.wavoipTokens.split(",")[0]?.trim();
  if (!token) return null;

  // Tenta varios endpoints comuns - Wavoip pode variar
  const candidates = [
    call.wavoipCallId
      ? `${config.WAVOIP_API_BASE_URL}/calls/${call.wavoipCallId}/recording`
      : null,
    call.wavoipCallId
      ? `${config.WAVOIP_API_BASE_URL}/recording/${call.wavoipCallId}`
      : null,
    call.whatsappCallId
      ? `${config.WAVOIP_API_BASE_URL}/calls/${call.whatsappCallId}/audio`
      : null,
  ].filter(Boolean) as string[];

  for (const url of candidates) {
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "arraybuffer",
        timeout: 30_000,
      });
      if (res.status === 200 && res.data) {
        return {
          buffer: Buffer.from(res.data),
          filename: `call-${call.id}.mp3`,
        };
      }
    } catch (e: any) {
      log.debug({ url, status: e?.response?.status }, "recording fetch failed");
    }
  }
  return null;
}

async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<string | null> {
  try {
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("file", audioBuffer, { filename });
    form.append("model", config.OPENAI_WHISPER_MODEL);
    form.append("response_format", "text");

    const res = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          Authorization: `Bearer ${openaiKey()}`,
          ...form.getHeaders(),
        },
        timeout: 120_000,
        maxBodyLength: Infinity,
      }
    );
    return typeof res.data === "string"
      ? res.data
      : res.data?.text ?? null;
  } catch (e: any) {
    log.warn({ err: e?.response?.data ?? e?.message }, "Whisper failed");
    return null;
  }
}

const SUMMARY_PROMPT = `Resuma esta transcricao de ligacao telefonica em ate 5 bullets concisos (português). Inclua: combinados, valores, próximos passos, prazos quando mencionados. Use *negrito* nos pontos críticos.`;

async function summarizeWithOpenAI(transcript: string): Promise<string | null> {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: openaiSummaryModel(),
        max_tokens: 600,
        temperature: 0.3,
        messages: [
          { role: "system", content: SUMMARY_PROMPT },
          {
            role: "user",
            content: `---TRANSCRICAO---\n${transcript}\n---FIM---`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${openaiKey()}`,
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      }
    );
    const text = res.data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch (e: any) {
    log.warn(
      { err: e?.response?.data ?? e?.message },
      "OpenAI summary failed"
    );
    return null;
  }
}

async function summarizeWithClaude(transcript: string): Promise<string | null> {
  try {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: anthropicModel(),
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: `${SUMMARY_PROMPT}\n\n---TRANSCRICAO---\n${transcript}\n---FIM---`,
          },
        ],
      },
      {
        headers: {
          "x-api-key": anthropicKey(),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 60_000,
      }
    );
    const blocks = res.data?.content ?? [];
    const text = blocks
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    return text || null;
  } catch (e: any) {
    log.warn({ err: e?.response?.data ?? e?.message }, "Claude failed");
    return null;
  }
}
