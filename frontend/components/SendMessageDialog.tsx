"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendMessageApi, fetchSessions } from "@/lib/api";
import { formatPhone } from "@/lib/utils";

/**
 * Modal global pra envio de mensagem WhatsApp manual.
 *
 * Disparo: useWebphoneStore().openSendMessage({sessionId, to, contactName?, prefilledText?})
 */
export function SendMessageDialog() {
  const req = useWebphoneStore((s) => s.sendMessageRequest);
  const close = useWebphoneStore((s) => s.closeSendMessage);

  const [text, setText] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sessionId, setSessionId] = React.useState<number | null>(null);
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<
    Array<{ id: number; name: string; status: string; number?: string | null }>
  >([]);

  React.useEffect(() => {
    if (!req) return;
    setText(req.prefilledText ?? "");
    setTo(req.to);
    setSessionId(req.sessionId);
    setSent(false);
    setError(null);
    fetchSessions().then((s) =>
      setSessions(
        s.map((x) => ({
          id: x.id,
          name: x.name,
          status: x.status,
          number: x.number,
        }))
      )
    );
  }, [req]);

  async function handleSend() {
    if (!sessionId || !to.trim() || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendMessageApi(sessionId, to.trim(), text.trim());
      setSent(true);
      setTimeout(() => {
        close();
      }, 800);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Falha ao enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={!!req}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar mensagem WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="send-session">Conexao</Label>
            <select
              id="send-session"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(Number(e.target.value))}
              className="h-11 rounded-xl border border-[var(--border)] bg-transparent px-4 text-sm focus-visible:ring-2 focus-visible:ring-wavoip-500"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {sessions.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  disabled={s.status !== "CONNECTED"}
                >
                  {s.name}
                  {s.number ? ` (+${s.number})` : ""}
                  {s.status !== "CONNECTED" ? ` - ${s.status}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="send-to">Numero / JID</Label>
            <Input
              id="send-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="ex: 5511999999999"
              autoFocus
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Apenas digitos (E.164). {req?.contactName && `${req.contactName}: `}
              {to && formatPhone(to)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="send-text">Mensagem</Label>
            <Textarea
              id="send-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Digite a mensagem..."
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 rounded-lg bg-red-500/10 border border-red-500/30 p-2">
              {error}
            </p>
          )}
          {sent && (
            <p className="text-xs text-green-400 rounded-lg bg-green-500/10 border border-green-500/30 p-2">
              Mensagem enviada!
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || !sessionId || !to.trim() || !text.trim()}
          >
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
