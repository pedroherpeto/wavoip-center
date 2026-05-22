"use client";

import * as React from "react";
import { MessageSquare, Send } from "lucide-react";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import { fetchSessions, type SessionRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MessagesSection() {
  const openSendMessage = useWebphoneStore((s) => s.openSendMessage);
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  const connected = sessions.filter((s) => s.status === "CONNECTED");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[var(--muted-foreground)]">
          Envio manual de mensagem WhatsApp por qualquer conexão ativa.
        </p>
        <Button
          onClick={() =>
            openSendMessage({ sessionId: connected[0]?.id ?? 0, to: "" })
          }
          disabled={connected.length === 0}
        >
          <Send className="h-4 w-4" />
          Nova mensagem
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexões disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Carregando...
            </p>
          ) : connected.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Nenhuma conexão conectada. Vá em <code>/sessions</code> e conecte
              uma.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {connected.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {s.number && (
                      <div className="text-xs text-[var(--muted-foreground)]">
                        +{s.number}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openSendMessage({ sessionId: s.id, to: "" })
                    }
                  >
                    <MessageSquare className="h-4 w-4" />
                    Enviar por esta
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
