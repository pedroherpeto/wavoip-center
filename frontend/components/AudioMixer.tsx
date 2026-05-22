"use client";

import * as React from "react";
import { api, fetchSessions, parseWelcomeSequence } from "@/lib/api";
import { useWebphoneStore } from "@/lib/store/webphone-store";

/**
 * Mixer de audio pra URA na chamada ao vivo.
 *
 * Estrategia:
 *  1. Monkey-patch navigator.mediaDevices.getUserMedia ANTES do widget Wavoip
 *     pedir o microfone. Substitui o stream do mic por um stream sintetico
 *     vindo de um AudioContext que mixa: mic real + arquivo de audio.
 *  2. Quando o widget atende (onPeerAccept/onAccept/onAnswer), resolve qual
 *     audio tocar:
 *     - Se incomingCall tem sessionId -> busca o primeiro step de audio com
 *       injectOnAnswer=true na welcomeSequence dessa sessao
 *     - Senao: fallback no setting global `on_accept_audio_url`
 *  3. Ao terminar (onEnd/onPeerReject), para o audio.
 */

interface MixerHandle {
  ctx: AudioContext;
  destination: MediaStreamAudioDestinationNode;       // vai pro widget (mic+URA)
  recordDestination: MediaStreamAudioDestinationNode;  // grava mic+URA+remoto
  micSource: MediaStreamAudioSourceNode | null;
  currentAudio: HTMLAudioElement | null;
  currentSource: MediaElementAudioSourceNode | null;
  remoteSources: MediaStreamAudioSourceNode[];
  recorder: MediaRecorder | null;
  recordChunks: Blob[];
  recordingCallId: string | null;
}

declare global {
  interface Window {
    __pabxAudioMixer?: MixerHandle;
    __pabxGetUserMediaPatched?: boolean;
    __pabxRTCPatched?: boolean;
    __pabxResolveAudioUrl?: () => string;
    __pabxMicHandlerInstalled?: boolean;
    __pabxLastCallId?: string;
  }
}

// Handler module-level: persiste atraves de HMR. Usa a funcao
// resolveAudioUrl que o componente publica em window.__pabxResolveAudioUrl.
function installMicHandlerOnce() {
  if (typeof window === "undefined") return;
  if (window.__pabxMicHandlerInstalled) return;
  window.__pabxMicHandlerInstalled = true;

  window.addEventListener("pabx:mic-acquired", () => {
    console.log("[AudioMixer] mic-acquired event recebido");
    // Inicia gravacao da chamada
    startRecording();
    // Toca URA se configurada
    setTimeout(() => {
      const resolve = window.__pabxResolveAudioUrl;
      const url = resolve ? resolve() : "";
      if (url) playUrl(url);
      else {
        console.log(
          "[AudioMixer] sem URA configurada - so gravando (sem injetar audio)"
        );
      }
    }, 300);
  });

  // Polling pra parar quando a chamada termina
  setInterval(() => {
    const w: any = (window as any).wavoip;
    const active = w?.call?.getCallActive?.();
    const mixer = window.__pabxAudioMixer;
    if (!active) {
      if (mixer?.currentAudio) {
        console.log("[AudioMixer] sem chamada ativa - parando URA");
        stopAudio();
      }
      if (mixer?.recorder && mixer.recorder.state === "recording") {
        stopRecording();
      }
    } else {
      // captura o callId atual (pra associar a gravacao na hora do stop)
      const peer = active?.peer ?? active;
      const callId = (active as any)?.id || (active as any)?.callId;
      if (callId) window.__pabxLastCallId = callId;
    }
  }, 1000);
}

function patchGetUserMedia() {
  if (typeof window === "undefined") return;
  if (!navigator.mediaDevices?.getUserMedia) return;
  if (window.__pabxGetUserMediaPatched) return;
  window.__pabxGetUserMediaPatched = true;

  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async function patchedGetUserMedia(
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream> {
    if (!constraints?.audio) return orig(constraints);
    const micStream = await orig(constraints);
    try {
      const Ctor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return micStream;

      // Reusa o ctx se ja existir (widget pode pedir mic mais de uma vez)
      let mixer = window.__pabxAudioMixer;
      if (!mixer) {
        const ctx: AudioContext = new Ctor();
        const destination = ctx.createMediaStreamDestination();
        const recordDestination = ctx.createMediaStreamDestination();
        const micSource = ctx.createMediaStreamSource(micStream);
        micSource.connect(destination);
        micSource.connect(recordDestination);
        mixer = {
          ctx,
          destination,
          recordDestination,
          micSource,
          currentAudio: null,
          currentSource: null,
          remoteSources: [],
          recorder: null,
          recordChunks: [],
          recordingCallId: null,
        };
        window.__pabxAudioMixer = mixer;
        console.log("[AudioMixer] mic interceptado - mixer criado");
      } else {
        // Reconecta o novo mic aos destinations
        try {
          mixer.micSource?.disconnect();
        } catch {}
        mixer.micSource = mixer.ctx.createMediaStreamSource(micStream);
        mixer.micSource.connect(mixer.destination);
        mixer.micSource.connect(mixer.recordDestination);
        console.log("[AudioMixer] mic reconectado");
      }

      // Dispara evento global - sinalizando que uma chamada ESTA ATENDENDO
      console.log("[AudioMixer] dispatchando pabx:mic-acquired");
      window.dispatchEvent(new CustomEvent("pabx:mic-acquired"));
      return mixer.destination.stream;
    } catch (e) {
      console.error("[AudioMixer] mixer falhou, devolvendo mic puro", e);
      return micStream;
    }
  };
}

// Patch RTCPeerConnection para capturar o stream remoto e injetar
// no recordDestination do mixer (grava ambos os lados da chamada).
function patchRTCPeerConnection() {
  if (typeof window === "undefined") return;
  if (window.__pabxRTCPatched) return;
  const Original = (window as any).RTCPeerConnection;
  if (!Original) return;
  window.__pabxRTCPatched = true;

  const Patched: any = function (...args: any[]) {
    const pc = new Original(...args);
    console.log("[AudioMixer] RTCPeerConnection criada", args);
    pc.addEventListener("track", (event: RTCTrackEvent) => {
      const mixer = window.__pabxAudioMixer;
      console.log(
        "[AudioMixer] track event:",
        event.track.kind,
        "id:",
        event.track.id,
        "muted:",
        event.track.muted,
        "enabled:",
        event.track.enabled
      );
      if (!mixer) {
        console.warn("[AudioMixer] track chegou mas mixer nao existe ainda");
        return;
      }
      if (event.track.kind !== "audio") return;
      const stream = event.streams?.[0];
      if (!stream) return;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;
      try {
        const remoteStream = new MediaStream(audioTracks);
        const source = mixer.ctx.createMediaStreamSource(remoteStream);
        // Conecta APENAS no recordDestination (nao no destination que vai pro
        // peer, senao gera eco)
        source.connect(mixer.recordDestination);
        mixer.remoteSources.push(source);
        console.log("[AudioMixer] remote audio capturado - tracks:", audioTracks.length);
      } catch (e) {
        console.warn("[AudioMixer] capture remote falhou", e);
      }
    });
    return pc;
  };
  Patched.prototype = Original.prototype;
  Patched.generateCertificate = Original.generateCertificate?.bind(Original);
  (window as any).RTCPeerConnection = Patched;
  console.log("[AudioMixer] RTCPeerConnection patched - gravacao bilateral ativa");
}

function startRecording() {
  const mixer = window.__pabxAudioMixer;
  if (!mixer) return;
  if (mixer.recorder && mixer.recorder.state !== "inactive") return;
  try {
    const mimeCandidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    const mimeType = mimeCandidates.find((m) =>
      MediaRecorder.isTypeSupported(m)
    );
    const recordStream = mixer.recordDestination.stream;
    const tracks = recordStream.getAudioTracks();
    console.log(
      "[AudioMixer] iniciando gravacao - tracks no recordStream:",
      tracks.length,
      tracks.map((t) => ({ id: t.id, muted: t.muted, enabled: t.enabled }))
    );
    console.log(
      "[AudioMixer] remote sources conectados:",
      mixer.remoteSources.length
    );
    const recorder = new MediaRecorder(
      recordStream,
      mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined
    );
    mixer.recordChunks = [];
    mixer.recordingCallId = window.__pabxLastCallId ?? null;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) mixer.recordChunks.push(e.data);
    };
    recorder.onstop = () => {
      const callId = mixer.recordingCallId;
      const chunks = mixer.recordChunks;
      mixer.recordChunks = [];
      mixer.recordingCallId = null;
      if (chunks.length === 0) return;
      const ext = (mimeType?.includes("webm") ? "webm" : mimeType?.includes("ogg") ? "ogg" : "mp4");
      const blob = new Blob(chunks, { type: mimeType ?? "audio/webm" });
      uploadRecording(blob, ext, callId).catch((e) =>
        console.error("[AudioMixer] upload recording falhou", e)
      );
    };
    recorder.start(2000); // chunks de 2s
    mixer.recorder = recorder;
    console.log("[AudioMixer] gravacao iniciada", { mimeType });
  } catch (e) {
    console.error("[AudioMixer] startRecording falhou", e);
  }
}

function stopRecording() {
  const mixer = window.__pabxAudioMixer;
  if (!mixer?.recorder) return;
  if (mixer.recorder.state === "inactive") return;
  try {
    mixer.recorder.stop();
    console.log("[AudioMixer] gravacao parada - upload em seguida");
  } catch (e) {
    console.warn("[AudioMixer] stopRecording falhou", e);
  }
}

async function uploadRecording(
  blob: Blob,
  ext: string,
  whatsappCallId: string | null
): Promise<void> {
  if (blob.size < 1024) {
    console.warn("[AudioMixer] gravacao muito curta, ignorando", blob.size);
    return;
  }
  // Expoe pra inspecao manual no console: window.__pabxLastRecording
  try {
    const url = URL.createObjectURL(blob);
    (window as any).__pabxLastRecording = {
      blob,
      url,
      size: blob.size,
      callId: whatsappCallId,
    };
    console.log(
      "[AudioMixer] gravacao disponivel localmente em window.__pabxLastRecording.url - reproduza pra checar se tem voz"
    );
  } catch {}

  const form = new FormData();
  form.append("file", blob, `recording.${ext}`);
  if (whatsappCallId) form.append("whatsappCallId", whatsappCallId);
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${apiUrl}/calls/recording`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  console.log("[AudioMixer] upload concluido", data);
}

// Fallback robusto: intercepta o srcObject de HTMLMediaElement.
// O widget Wavoip cria um <audio> pra tocar o som do peer; quando ele
// seta audio.srcObject = remoteStream, capturamos esse stream e conectamos
// ao recordDestination do mixer. Funciona MESMO se o RTCPeerConnection
// patch nao tiver pegado (e.g. widget guardou ref cedo).
function patchAudioSrcObject() {
  if (typeof window === "undefined") return;
  if ((window as any).__pabxAudioSrcObjectPatched) return;
  (window as any).__pabxAudioSrcObjectPatched = true;

  try {
    const proto = HTMLMediaElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "srcObject");
    if (!original || !original.set || !original.get) {
      console.warn("[AudioMixer] HTMLMediaElement.srcObject descriptor ausente");
      return;
    }

    Object.defineProperty(proto, "srcObject", {
      configurable: true,
      enumerable: true,
      get() {
        return original.get!.call(this);
      },
      set(value: MediaStream | null) {
        original.set!.call(this, value);
        try {
          if (
            value instanceof MediaStream &&
            this instanceof HTMLAudioElement
          ) {
            const tracks = value.getAudioTracks();
            console.log(
              "[AudioMixer] <audio>.srcObject setado - audio tracks:",
              tracks.length
            );
            const mixer = window.__pabxAudioMixer;
            if (mixer && tracks.length > 0) {
              // Cria source uma vez por stream
              const tagged = (value as any).__pabxConnected;
              if (!tagged) {
                (value as any).__pabxConnected = true;
                const remoteStream = new MediaStream(tracks);
                const source = mixer.ctx.createMediaStreamSource(remoteStream);
                source.connect(mixer.recordDestination);
                mixer.remoteSources.push(source);
                console.log(
                  "[AudioMixer] capturado via srcObject - tracks:",
                  tracks.length
                );
              }
            }
          }
        } catch (e) {
          console.warn("[AudioMixer] srcObject capture falhou", e);
        }
      },
    });
    console.log(
      "[AudioMixer] HTMLAudioElement.srcObject patched (captura peer via <audio>)"
    );
  } catch (e) {
    console.warn("[AudioMixer] patchAudioSrcObject falhou", e);
  }
}

if (typeof window !== "undefined") {
  patchGetUserMedia();
  patchRTCPeerConnection();
  patchAudioSrcObject();
  installMicHandlerOnce();
}

async function playUrl(url: string): Promise<void> {
  const mixer = window.__pabxAudioMixer;
  if (!mixer) {
    console.warn(
      "[AudioMixer] mixer nao inicializado - widget ainda nao pediu mic"
    );
    return;
  }
  stopAudio();

  // AudioContext pode estar suspenso (autoplay policy)
  if (mixer.ctx.state === "suspended") {
    try {
      await mixer.ctx.resume();
      console.log("[AudioMixer] AudioContext resumed");
    } catch (e) {
      console.warn("[AudioMixer] resume falhou", e);
    }
  }

  try {
    console.log("[AudioMixer] preparando play:", url);
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.loop = false;
    audio.addEventListener("error", (ev) =>
      console.error("[AudioMixer] <audio> error:", audio.error, ev)
    );
    audio.addEventListener("playing", () =>
      console.log("[AudioMixer] <audio> playing")
    );
    audio.addEventListener("ended", () =>
      console.log("[AudioMixer] <audio> ended")
    );

    const source = mixer.ctx.createMediaElementSource(audio);
    source.connect(mixer.destination); // pro peer
    source.connect(mixer.ctx.destination); // pro agente ouvir

    mixer.currentAudio = audio;
    mixer.currentSource = source;
    await audio.play();
    console.log("[AudioMixer] tocando URA OK:", url);
  } catch (e) {
    console.error("[AudioMixer] play falhou", e);
  }
}

function stopAudio(): void {
  const mixer = window.__pabxAudioMixer;
  if (!mixer) return;
  if (mixer.currentAudio) {
    try {
      mixer.currentAudio.pause();
      mixer.currentAudio.currentTime = 0;
    } catch {}
    mixer.currentAudio = null;
  }
  if (mixer.currentSource) {
    try {
      mixer.currentSource.disconnect();
    } catch {}
    mixer.currentSource = null;
  }
}

export function AudioMixer() {
  const widgetReady = useWebphoneStore((s) => s.widgetReady);

  // Mapas e setting global ficam em refs pra serem lidos no momento do accept
  const sessionAudioMapRef = React.useRef<Record<number, string>>({});
  const globalFallbackRef = React.useRef<string>("");

  // Recarrega mapa de sessoes e fallback global a cada vez que o widget fica ready
  React.useEffect(() => {
    if (!widgetReady) return;

    let cancelled = false;
    const reloadConfig = async () => {
      try {
        const [sessions, settingRes] = await Promise.all([
          fetchSessions(),
          api.get("/settings/on_accept_audio_url").catch(() => null),
        ]);
        if (cancelled) return;
        const map: Record<number, string> = {};
        for (const s of sessions) {
          const steps = parseWelcomeSequence(s.welcomeSequence);
          const audioStep = steps.find(
            (step) => step.type === "audio" && step.injectOnAnswer && step.audioUrl
          );
          if (audioStep?.audioUrl) map[s.id] = audioStep.audioUrl;
        }
        sessionAudioMapRef.current = map;
        globalFallbackRef.current = String(
          settingRes?.data?.value ?? ""
        ).trim();
        console.log(
          "[AudioMixer] URA por sessao:",
          Object.keys(map).length,
          "configurada(s) | fallback:",
          globalFallbackRef.current ? "sim" : "nao"
        );
      } catch (e) {
        console.warn("[AudioMixer] reload config falhou", e);
      }
    };
    reloadConfig();

    // Recarrega periodicamente (qualquer edicao nas sessions/settings reflete)
    const interval = setInterval(reloadConfig, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [widgetReady]);

  // Publica resolveAudioUrl no window pro handler module-level usar.
  // Re-publica sempre que widgetReady muda ou os mapas atualizam.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.__pabxResolveAudioUrl = (): string => {
      const incoming = useWebphoneStore.getState().incomingCall;
      const sessionId = incoming?.sessionId;
      const map = sessionAudioMapRef.current;
      console.log(
        "[AudioMixer] resolve - incoming.sessionId:",
        sessionId,
        "mapa keys:",
        Object.keys(map),
        "fallback:",
        globalFallbackRef.current ? "sim" : "nao"
      );
      if (sessionId && map[sessionId]) return map[sessionId];
      const keys = Object.keys(map);
      if (keys.length === 1) return map[Number(keys[0])];
      return globalFallbackRef.current;
    };
  }, [widgetReady]);

  return null;
}
