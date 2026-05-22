"use client";

import * as React from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import { fetchSessions } from "@/lib/api";
import { Button } from "@/components/ui/button";

/**
 * Notificacoes browser/desktop pra chamadas recebidas e callbacks.
 *
 * Usa Web Notifications API (nativa, sem service worker). Funciona
 * mesmo com a aba em background, desde que o browser tenha permissao.
 *
 * Para PWA + push real (mesmo com aba fechada): precisaria de service
 * worker + VAPID + backend Push. Por ora, esta versao basica cobre
 * 95% dos casos.
 */

type SessionMap = Record<number, { name: string; number?: string | null }>;

function notify(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  try {
    const n = new Notification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: true,
      ...options,
    });
    return n;
  } catch (e) {
    console.warn("[Notifications] new Notification falhou", e);
    return null;
  }
}

export function NotificationsBridge() {
  const incomingCall = useWebphoneStore((s) => s.incomingCall);
  const [sessions, setSessions] = React.useState<SessionMap>({});
  const lastNotifiedRef = React.useRef<string | number | null>(null);
  const lastNotifRef = React.useRef<Notification | null>(null);

  // Cacheia sessoes (pra mostrar qual numero recebeu)
  React.useEffect(() => {
    fetchSessions()
      .then((list) => {
        const m: SessionMap = {};
        for (const s of list) {
          m[s.id] = { name: s.name, number: s.number };
        }
        setSessions(m);
      })
      .catch(() => {});
  }, []);

  // Notifica em call.incoming
  React.useEffect(() => {
    if (!incomingCall) return;
    if (lastNotifiedRef.current === incomingCall.callId) return;
    lastNotifiedRef.current = incomingCall.callId;

    const session = incomingCall.sessionId
      ? sessions[incomingCall.sessionId]
      : null;
    const title = `Chamada de ${incomingCall.contactName || incomingCall.from}`;
    const body = session
      ? `Recebida em ${session.name}${session.number ? ` (+${session.number})` : ""}`
      : "Chamada recebida";

    // Fecha notificacao anterior se ainda aberta
    try {
      lastNotifRef.current?.close();
    } catch {}

    const n = notify(title, {
      body,
      tag: "incoming-call",
      ...({ vibrate: [200, 100, 200, 100, 200] } as any),
    });
    lastNotifRef.current = n;

    if (n) {
      n.onclick = () => {
        try {
          window.focus();
          n.close();
        } catch {}
      };
    }
  }, [incomingCall, sessions]);

  return null;
}

/**
 * Botao que pede permissao de notificacao. Mostrar nos /settings ou Sidebar.
 */
export function NotificationsToggle() {
  const [perm, setPerm] = React.useState<NotificationPermission | "unsupported">(
    "default"
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
  }, []);

  async function ask() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === "granted") {
      new Notification("Wavoip PABX", {
        body: "Notificações habilitadas! Você receberá alertas de chamadas recebidas.",
        icon: "/icon-192.png",
      });
    }
  }

  if (perm === "unsupported") {
    return (
      <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2">
        <BellOff className="h-4 w-4" />
        Navegador não suporta notificações
      </div>
    );
  }
  if (perm === "granted") {
    return (
      <div className="text-xs text-green-400 flex items-center gap-2">
        <BellRing className="h-4 w-4" />
        Notificações ativas
      </div>
    );
  }
  if (perm === "denied") {
    return (
      <div className="text-xs text-amber-400 flex items-center gap-2">
        <BellOff className="h-4 w-4" />
        Notificações bloqueadas - libere nas configurações do navegador
      </div>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={ask}>
      <Bell className="h-4 w-4" />
      Ativar notificações
    </Button>
  );
}
