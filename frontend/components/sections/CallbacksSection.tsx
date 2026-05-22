"use client";

import * as React from "react";
import { Phone, Check, X, MessageSquare, Plus } from "lucide-react";
import {
  fetchCallbacks,
  updateCallback,
  createCallback,
  fetchSessions,
  type CallbackRecord,
  type SessionRecord,
} from "@/lib/api";
import { useWebphoneStore } from "@/lib/store/webphone-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatPhone } from "@/lib/utils";

function StatusBadge({ status }: { status: CallbackRecord["status"] }) {
  const map = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    done: "bg-green-500/15 text-green-400 border-green-500/30",
    cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  };
  const labels = {
    pending: "Pendente",
    done: "Concluido",
    cancelled: "Cancelado",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        map[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

function NewCallbackDialog({
  sessions,
  onCreated,
}: {
  sessions: SessionRecord[];
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [sessionId, setSessionId] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState("manual");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open && !sessionId && sessions.length > 0) setSessionId(sessions[0].id);
  }, [open, sessionId, sessions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !phone.trim()) return;
    setSubmitting(true);
    try {
      await createCallback({
        sessionId,
        phone: phone.replace(/\D/g, ""),
        reason: reason.trim() || "manual",
      });
      setOpen(false);
      setPhone("");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={sessions.length === 0}>
          <Plus className="h-4 w-4" />
          Novo callback
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo callback</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cb-session">Conexao</Label>
            <select
              id="cb-session"
              value={sessionId ?? ""}
              onChange={(e) => setSessionId(Number(e.target.value))}
              className="h-11 rounded-xl border border-[var(--border)] bg-transparent px-4 text-sm focus-visible:ring-2 focus-visible:ring-wavoip-500"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cb-phone">Numero</Label>
            <Input
              id="cb-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cb-reason">Motivo</Label>
            <Input
              id="cb-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="manual / missed_call / ivr_request"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CallbacksSection() {
  const [items, setItems] = React.useState<CallbackRecord[]>([]);
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | CallbackRecord["status"]>(
    "pending"
  );
  const requestWavoipCall = useWebphoneStore((s) => s.requestWavoipCall);
  const openSendMessage = useWebphoneStore((s) => s.openSendMessage);

  const load = React.useCallback(async () => {
    const [cbs, ss] = await Promise.all([
      fetchCallbacks(filter === "all" ? {} : { status: filter }),
      fetchSessions(),
    ]);
    setItems(cbs);
    setSessions(ss);
    setLoading(false);
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function markDone(id: number) {
    await updateCallback(id, { status: "done" });
    load();
  }
  async function markCancelled(id: number) {
    await updateCallback(id, { status: "cancelled" });
    load();
  }

  function sessionOf(id: number) {
    return sessions.find((s) => s.id === id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Callbacks</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Fila de retornos pendentes (missed calls, pedidos de IVR, manuais).
          </p>
        </div>
        <NewCallbackDialog sessions={sessions} onCreated={load} />
      </div>

      <div className="flex gap-2">
        {(["pending", "all", "done", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filter === f
                ? "bg-wavoip-500 text-black border-transparent"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            Nenhum callback {filter !== "all" ? filter : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((cb) => {
            const session = sessionOf(cb.sessionId);
            const tokens = session?.wavoipTokens?.split(",")[0]?.trim();
            return (
              <Card key={cb.id}>
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {formatPhone(cb.phone)}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={cb.status} />
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {cb.reason} - {new Date(cb.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {session && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        via {session.name}
                      </p>
                    )}
                  </div>
                </CardHeader>
                {cb.status === "pending" && (
                  <CardContent className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        requestWavoipCall({
                          phone: cb.phone,
                          token: tokens,
                        })
                      }
                      disabled={!tokens}
                      title={
                        !tokens
                          ? "Sessao sem tokens Wavoip"
                          : "Ligar de volta"
                      }
                    >
                      <Phone className="h-4 w-4" />
                      Ligar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openSendMessage({
                          sessionId: cb.sessionId,
                          to: cb.phone,
                        })
                      }
                    >
                      <MessageSquare className="h-4 w-4" />
                      Mensagem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markDone(cb.id)}
                    >
                      <Check className="h-4 w-4" />
                      Marcar feito
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markCancelled(cb.id)}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
