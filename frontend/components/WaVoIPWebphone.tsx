"use client";

import * as React from "react";
import Script from "next/script";
import { AlertTriangle } from "lucide-react";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import { fetchSessions } from "@/lib/api";

const WAVOIP_CDN =
  process.env.NEXT_PUBLIC_WAVOIP_WIDGET_URL ||
  "https://cdn.jsdelivr.net/npm/@wavoip/wavoip-webphone/dist/index.umd.min.js";

declare global {
  interface Window {
    wavoipWebphone?: {
      container: HTMLElement | null;
      root: unknown;
      render: (opts: Record<string, unknown>) => Promise<unknown>;
      destroy?: () => void;
    };
    wavoip?: {
      device: { addDevice: (token: string) => void };
      call: {
        startCall: (phone: string, tokens?: string[]) => Promise<unknown> | void;
        onOffer?: (cb: (data: unknown) => void) => void;
        getOffers?: () => Array<{ id: string; status?: string; peer?: { phone?: string } }>;
        getCallActive?: () => { peer?: { phone?: string } } | null;
      };
      settings?: { setShowWidgetButton?: (show: boolean) => void };
    };
    __wavoipInited?: boolean;
  }
}

/**
 * Inicializa o widget Wavoip oficial seguindo o padrao do zpro:
 *  1. <Script> carrega o UMD; expoe window.wavoipWebphone (factory) e
 *     window.wavoip (API runtime apos render).
 *  2. await window.wavoipWebphone.render({ buttonPosition }) - monta UI
 *     com botao flutuante (nao recebe tokens aqui).
 *  3. window.wavoip.device.addDevice(token) - registra cada token/canal.
 *  4. window.wavoip.settings.setShowWidgetButton(true) - botao visivel.
 *  5. window.wavoip.call.onOffer(...) - listener de incoming (widget
 *     ja exibe UI nativa de chamada; aqui apenas logamos no PABX).
 *
 * Bridges com a store:
 *  - pendingWavoipCall -> window.wavoip.call.startCall(phone, [token])
 */
export function WaVoIPWebphone() {
  const [loaded, setLoaded] = React.useState(false);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "no-tokens" | "error"
  >("loading");
  const [tokensCount, setTokensCount] = React.useState(0);
  const pending = useWebphoneStore((s) => s.pendingWavoipCall);
  const clearPendingCall = useWebphoneStore((s) => s.clearPendingCall);
  const setWidgetReady = useWebphoneStore((s) => s.setWidgetReady);
  const setWidgetWarning = useWebphoneStore((s) => s.setWidgetWarning);
  const widgetWarning = useWebphoneStore((s) => s.widgetWarning);
  const addWavoipToken = useWebphoneStore((s) => s.addWavoipToken);
  const clearWavoipTokens = useWebphoneStore((s) => s.clearWavoipTokens);
  const setDialing = useWebphoneStore((s) => s.setDialing);
  const wavoipTokensMap = useWebphoneStore((s) => s.wavoipTokens);

  React.useEffect(() => {
    if (!loaded || typeof window === "undefined") return;
    if (window.__wavoipInited) return; // ja inicializado nesta pagina

    const mod = window.wavoipWebphone;
    if (!mod?.render) {
      setStatus("error");
      setWidgetWarning("window.wavoipWebphone.render nao disponivel");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // 1. Busca tokens de TODAS as sessoes conectadas e popula store
        clearWavoipTokens();
        const sessions = await fetchSessions();
        if (cancelled) return;
        const tokenEntries: Array<{
          token: string;
          inboxName: string;
          sessionId: number;
        }> = [];
        for (const s of sessions) {
          if (s.status !== "CONNECTED" || !s.wavoipTokens) continue;
          const tokens = s.wavoipTokens
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          for (const token of tokens) {
            tokenEntries.push({ token, inboxName: s.name, sessionId: s.id });
          }
        }
        // Popula store global (outros componentes podem listar)
        for (const e of tokenEntries) addWavoipToken(e);

        const tokens = tokenEntries.map((e) => e.token);
        setTokensCount(tokens.length);

        if (tokens.length === 0) {
          setStatus("no-tokens");
          setWidgetWarning(
            "Nenhuma conexao com tokens Wavoip. Configure tokens em /sessions."
          );
          return;
        }

        // 2. Monta widget com botao flutuante (igual zpro)
        const api = await mod.render({
          buttonPosition: {
            x: window.innerWidth - 80,
            y: window.innerHeight - 120,
          },
        });
        if (!api) {
          setStatus("error");
          setWidgetWarning("Widget render retornou null");
          return;
        }

        // 3. Mostra botao flutuante (default visivel)
        try {
          window.wavoip?.settings?.setShowWidgetButton?.(true);
        } catch (e) {
          console.warn("[Wavoip] setShowWidgetButton falhou", e);
        }

        // 4. Itera por TODOS os tokens e registra cada um como device (canal)
        for (const entry of tokenEntries) {
          try {
            window.wavoip?.device.addDevice(entry.token);
            console.log(
              `[Wavoip] addDevice OK: ${entry.inboxName} (${entry.token.slice(0, 8)}...)`
            );
          } catch (e) {
            console.warn(
              "[Wavoip] addDevice falhou",
              entry.token.slice(0, 8),
              e
            );
          }
        }

        // 5. Listener de incoming - widget exibe UI nativa. Capturamos
        // o id do offer pra associar a gravacao client-side ao Call no banco.
        try {
          window.wavoip?.call.onOffer?.((rawData: any) => {
            console.log("[Wavoip] incoming offer:", rawData);
            const callId = rawData?.id || rawData?.offer?.id;
            if (callId) {
              (window as any).__pabxLastCallId = callId;
              console.log("[Wavoip] __pabxLastCallId =", callId);
            }
          });
        } catch (e) {
          console.warn("[Wavoip] onOffer subscribe falhou", e);
        }

        // 6. Listeners de fim de chamada para desligar o spinner de dialing
        const dialDone = () => setDialing(false);
        const handlers: Array<[string, () => void]> = [
          ["onPeerAccept", dialDone],
          ["onPeerReject", dialDone],
          ["onUnanswered", dialDone],
          ["onEnd", dialDone],
          ["onCallEnd", dialDone],
        ];
        for (const [name, cb] of handlers) {
          const fn = (window.wavoip?.call as any)?.[name];
          if (typeof fn === "function") {
            try {
              fn(cb);
            } catch (e) {
              console.warn(`[Wavoip] ${name} hook falhou`, e);
            }
          }
        }

        window.__wavoipInited = true;
        setStatus("ready");
        setWidgetReady(true);
        setWidgetWarning(null);
      } catch (e) {
        console.error("[Wavoip] render flow failed", e);
        setStatus("error");
        setWidgetWarning("Falha ao renderizar widget Wavoip - veja console.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, setWidgetWarning, setWidgetReady]);

  // Bridge: pending dial -> widget startCall
  React.useEffect(() => {
    if (!pending || typeof window === "undefined") return;
    if (status !== "ready") return;
    const startCall = window.wavoip?.call?.startCall;
    if (typeof startCall !== "function") {
      console.warn("[Wavoip] startCall indisponivel");
      return;
    }

    // Usa token explicito, ou fallback pro primeiro token do store
    const fallbackToken = Object.values(wavoipTokensMap)[0]?.token;
    const tokenToUse = pending.token || fallbackToken;
    if (!tokenToUse) {
      console.warn(
        "[Wavoip] sem tokens disponiveis - configure tokens em /sessions e recarregue"
      );
      clearPendingCall();
      return;
    }
    const tokens = [tokenToUse];

    console.log(
      "[Wavoip] startCall:",
      pending.phone,
      "via token",
      tokenToUse.slice(0, 8) + "..."
    );
    setDialing(true);
    try {
      const result = startCall(pending.phone, tokens);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).catch((err) => {
          console.error("[Wavoip] startCall rejeitado", err);
          setDialing(false);
        });
      }
      // Safety net: se nenhum callback disparar em 60s, libera o botao
      setTimeout(() => setDialing(false), 60_000);
    } catch (err) {
      console.error("[Wavoip] startCall throw", err);
      setDialing(false);
    } finally {
      clearPendingCall();
    }
  }, [pending, status, clearPendingCall, wavoipTokensMap, setDialing]);

  return (
    <>
      <Script
        src={WAVOIP_CDN}
        strategy="afterInteractive"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setStatus("error");
          setWidgetWarning(
            "Widget UMD nao carregou. Ajuste NEXT_PUBLIC_WAVOIP_WIDGET_URL."
          );
        }}
      />

      <div
        className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)]/90 backdrop-blur px-3 py-1.5 text-xs shadow-lg pointer-events-none"
        title="Status do widget Wavoip"
      >
        <span
          className={
            status === "ready"
              ? "h-2 w-2 rounded-full bg-green-400"
              : status === "loading"
                ? "h-2 w-2 rounded-full bg-amber-400 animate-pulse"
                : "h-2 w-2 rounded-full bg-red-400"
          }
        />
        <span className="text-[var(--muted-foreground)]">
          Wavoip: {status} {status === "ready" && `(${tokensCount} canal${tokensCount !== 1 ? "is" : ""})`}
        </span>
      </div>

      {widgetWarning && (
        <div className="fixed bottom-14 left-4 z-30 max-w-xs rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur p-3 text-xs text-amber-300 flex items-start gap-2 shadow-lg">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{widgetWarning}</span>
        </div>
      )}
    </>
  );
}
