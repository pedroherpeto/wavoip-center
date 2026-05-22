"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Power,
  PowerOff,
  Trash2,
  RefreshCw,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  fetchSessions,
  createSession,
  updateSession,
  startSessionApi,
  stopSessionApi,
  deleteSession,
  parseWelcomeSequence,
  type SessionRecord,
  type WelcomeStep,
} from "@/lib/api";
import { WelcomeSequenceEditor } from "@/components/WelcomeSequenceEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: SessionRecord["status"] }) {
  const t = useTranslations("sessions");
  const map: Record<SessionRecord["status"], { label: string; cls: string }> = {
    CONNECTED: {
      label: t("connected"),
      cls: "bg-green-500/15 text-green-400 border-green-500/30",
    },
    QRCODE: {
      label: t("qrcode"),
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    OPENING: {
      label: t("opening"),
      cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    DISCONNECTED: {
      label: t("disconnected"),
      cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    },
  };
  const info = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        info.cls
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {info.label}
    </span>
  );
}

function NewSessionDialog({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("sessions");
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [locale, setLocale] = React.useState<"pt-BR" | "en-US">("pt-BR");
  const [wavoipTokens, setWavoipTokens] = React.useState("");
  const [rejectCalls, setRejectCalls] = React.useState(true);
  const [ivrEnabled, setIvrEnabled] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const created = await createSession({
        name: name.trim(),
        locale,
        wavoipTokens: wavoipTokens.trim() || undefined,
        rejectCalls,
        ivrEnabled,
      });
      await startSessionApi(created.id);
      setOpen(false);
      setName("");
      setWavoipTokens("");
      setRejectCalls(true);
      setIvrEnabled(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {t("new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="locale">{t("locale")}</Label>
            <select
              id="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value as "pt-BR" | "en-US")}
              className="h-11 rounded-xl border border-[var(--border)] bg-transparent px-4 text-sm focus-visible:ring-2 focus-visible:ring-wavoip-500"
            >
              <option value="pt-BR">Português (pt-BR)</option>
              <option value="en-US">English (en-US)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="wavoipTokens">{t("wavoipTokens")}</Label>
            <Textarea
              id="wavoipTokens"
              value={wavoipTokens}
              onChange={(e) => setWavoipTokens(e.target.value)}
              placeholder="token-1,token-2,..."
              rows={2}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("wavoipTokensHint")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="rejectCalls">{t("rejectCalls")}</Label>
            <Switch
              id="rejectCalls"
              checked={rejectCalls}
              onCheckedChange={setRejectCalls}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ivrEnabled">{t("ivrEnabled")}</Label>
            <Switch
              id="ivrEnabled"
              checked={ivrEnabled}
              onCheckedChange={setIvrEnabled}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? tCommon("loading") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SessionCard({
  session,
  onChanged,
}: {
  session: SessionRecord;
  onChanged: () => void;
}) {
  const t = useTranslations("sessions");
  const tCommon = useTranslations("common");
  const [editingName, setEditingName] = React.useState(session.name);
  // Colapsado por padrao - exceto se em QRCODE (precisa mostrar o QR)
  const [expanded, setExpanded] = React.useState(session.status === "QRCODE");
  const [editingTokens, setEditingTokens] = React.useState(
    session.wavoipTokens ?? ""
  );
  const [editingRejectMsg, setEditingRejectMsg] = React.useState(
    session.callRejectMessage ?? ""
  );
  const [editingSequence, setEditingSequence] = React.useState<WelcomeStep[]>(
    parseWelcomeSequence(session.welcomeSequence)
  );
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setEditingName(session.name);
    setEditingTokens(session.wavoipTokens ?? "");
    setEditingRejectMsg(session.callRejectMessage ?? "");
    setEditingSequence(parseWelcomeSequence(session.welcomeSequence));
    setDirty(false);
  }, [
    session.name,
    session.wavoipTokens,
    session.callRejectMessage,
    session.welcomeSequence,
  ]);

  // Forca expandido enquanto estiver em QRCODE
  React.useEffect(() => {
    if (session.status === "QRCODE") setExpanded(true);
  }, [session.status]);

  async function handleSave() {
    setBusy(true);
    try {
      await updateSession(session.id, {
        name: editingName.trim() || session.name,
        wavoipTokens: editingTokens,
        callRejectMessage: editingRejectMsg,
        welcomeSequence: editingSequence.length > 0 ? editingSequence : null,
      });
      setDirty(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    try {
      await startSessionApi(session.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await stopSessionApi(session.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    setBusy(true);
    try {
      await deleteSession(session.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wavoip-500/10 text-wavoip-500">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              value={editingName}
              onChange={(e) => {
                setEditingName(e.target.value);
                setDirty(true);
              }}
              className="font-semibold !h-9 !text-base bg-transparent border-transparent hover:border-[var(--border)] focus-visible:border-[var(--border)] -mx-2 px-2"
              aria-label={t("name")}
            />
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <StatusBadge status={session.status} />
              {session.number && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  +{session.number}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.status === "DISCONNECTED" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStart}
              disabled={busy}
              aria-label={t("start")}
            >
              <Power className="h-4 w-4" />
              <span className="hidden sm:inline">{t("start")}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStop}
              disabled={busy}
              aria-label={t("stop")}
            >
              <PowerOff className="h-4 w-4" />
              <span className="hidden sm:inline">{t("stop")}</span>
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy}
            aria-label={t("delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Colapsar" : "Expandir"}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {!expanded ? null : (
      <CardContent className="flex flex-col gap-4">
        {session.status === "QRCODE" && session.qrcode && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-300 text-center max-w-xs">
              {t("scanQr")}
            </p>
            <img
              src={session.qrcode}
              alt="QR code"
              className="h-64 w-64 rounded-lg bg-white p-2"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`tokens-${session.id}`}>{t("wavoipTokens")}</Label>
          <Textarea
            id={`tokens-${session.id}`}
            value={editingTokens}
            onChange={(e) => {
              setEditingTokens(e.target.value);
              setDirty(true);
            }}
            placeholder="token-1,token-2,..."
            rows={2}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("wavoipTokensHint")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`reject-${session.id}`}>
            {t("callRejectMessage")}
          </Label>
          <Textarea
            id={`reject-${session.id}`}
            value={editingRejectMsg}
            onChange={(e) => {
              setEditingRejectMsg(e.target.value);
              setDirty(true);
            }}
            placeholder=""
            rows={2}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            Usado apenas se nao houver sequencia de boas-vindas abaixo.
          </p>
        </div>

        <WelcomeSequenceEditor
          value={editingSequence}
          onChange={(v) => {
            setEditingSequence(v);
            setDirty(true);
          }}
        />

        {dirty && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={busy} size="sm">
              {busy ? tCommon("loading") : t("save")}
            </Button>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}

export default function SessionsPage() {
  const t = useTranslations("sessions");
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const data = await fetchSessions();
      setSessions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <NewSessionDialog onCreated={load} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {t("noSessions")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
