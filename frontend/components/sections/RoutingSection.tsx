"use client";

import * as React from "react";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  Plus,
  Trash2,
  Star,
  Ban,
  RotateCw,
} from "lucide-react";
import {
  fetchContactTags,
  upsertContactTag,
  deleteContactTag,
  fetchRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  type ContactTag,
  type RoutingRule,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatPhone } from "@/lib/utils";

const TAG_META = {
  blocked: { label: "Bloqueado", cls: "bg-red-500/15 text-red-400", Icon: Ban },
  vip: { label: "VIP", cls: "bg-amber-500/15 text-amber-400", Icon: Star },
  trusted: {
    label: "Confiável",
    cls: "bg-green-500/15 text-green-400",
    Icon: ShieldCheck,
  },
} as const;

function NewContactTagDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [tag, setTag] = React.useState<"blocked" | "vip" | "trusted">("blocked");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    try {
      await upsertContactTag({
        phone: phone.replace(/\D/g, ""),
        tag,
        reason: reason.trim() || undefined,
      });
      setOpen(false);
      setPhone("");
      setReason("");
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Novo contato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar contato</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ct-phone">Número</Label>
            <Input
              id="ct-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ct-tag">Tag</Label>
            <select
              id="ct-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value as any)}
              className="h-11 rounded-xl border border-[var(--border)] bg-transparent px-4 text-sm"
            >
              <option value="blocked">Bloqueado (rejeita silenciosamente)</option>
              <option value="vip">VIP (prioridade alta)</option>
              <option value="trusted">Confiável</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ct-reason">Motivo (opcional)</Label>
            <Input
              id="ct-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: telemarketing"
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
            <Button type="submit" disabled={busy || !phone.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type RuleForm = {
  name: string;
  priority: number;
  conditionType: "vip" | "blocked" | "tag" | "repeat" | "ddd" | "phone_match";
  conditionValue: string;
  actionType: "reject" | "block" | "tag";
  actionTag: string;
  active: boolean;
};

function RuleDialog({
  rule,
  onSaved,
}: {
  rule?: RoutingRule;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<RuleForm>(() => initialForm(rule));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm(initialForm(rule));
  }, [open, rule]);

  function initialForm(r?: RoutingRule): RuleForm {
    if (!r) {
      return {
        name: "",
        priority: 100,
        conditionType: "repeat",
        conditionValue: "3",
        actionType: "reject",
        actionTag: "",
        active: true,
      };
    }
    return {
      name: r.name,
      priority: r.priority,
      conditionType: (r.condition?.type as any) ?? "repeat",
      conditionValue:
        String(r.condition?.minCalls ?? r.condition?.value ?? ""),
      actionType: (r.action?.type as any) ?? "reject",
      actionTag: String(r.action?.tag ?? ""),
      active: r.active,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const condition: Record<string, any> = { type: form.conditionType };
      if (form.conditionType === "repeat")
        condition.minCalls = Number(form.conditionValue) || 3;
      else if (form.conditionType === "ddd")
        condition.value = form.conditionValue;
      else if (form.conditionType === "phone_match")
        condition.value = form.conditionValue;
      else if (form.conditionType === "tag")
        condition.value = form.conditionValue;

      const action: Record<string, any> = { type: form.actionType };
      if (form.actionTag) action.tag = form.actionTag;

      if (rule) {
        await updateRoutingRule(rule.id, {
          name: form.name,
          priority: form.priority,
          condition,
          action,
          active: form.active,
        });
      } else {
        await createRoutingRule({
          name: form.name,
          priority: form.priority,
          condition,
          action,
          active: form.active,
        });
      }
      setOpen(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rule ? (
          <Button size="sm" variant="outline">
            Editar
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            Nova regra
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Prioridade</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 flex flex-col gap-2">
            <Label className="text-xs uppercase">Condição</Label>
            <select
              value={form.conditionType}
              onChange={(e) =>
                setForm({ ...form, conditionType: e.target.value as any })
              }
              className="h-11 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm"
            >
              <option value="vip">VIP (contato marcado como VIP)</option>
              <option value="blocked">Bloqueado</option>
              <option value="tag">Tag custom</option>
              <option value="repeat">Repeat caller (N+ chamadas/24h)</option>
              <option value="ddd">DDD do número</option>
              <option value="phone_match">Regex no número</option>
            </select>
            {(form.conditionType === "repeat" ||
              form.conditionType === "ddd" ||
              form.conditionType === "phone_match" ||
              form.conditionType === "tag") && (
              <Input
                value={form.conditionValue}
                onChange={(e) =>
                  setForm({ ...form, conditionValue: e.target.value })
                }
                placeholder={
                  form.conditionType === "repeat"
                    ? "Min chamadas (ex: 3)"
                    : form.conditionType === "ddd"
                      ? "DDD (ex: 5511)"
                      : form.conditionType === "phone_match"
                        ? "Regex (ex: ^55119)"
                        : "Tag (ex: vip-gold)"
                }
              />
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] p-3 flex flex-col gap-2">
            <Label className="text-xs uppercase">Ação</Label>
            <select
              value={form.actionType}
              onChange={(e) =>
                setForm({ ...form, actionType: e.target.value as any })
              }
              className="h-11 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm"
            >
              <option value="reject">Rejeitar (corta a chamada)</option>
              <option value="block">Bloquear (igual rejeitar)</option>
              <option value="tag">Aplicar tag à chamada</option>
            </select>
            {form.actionType === "tag" && (
              <Input
                value={form.actionTag}
                onChange={(e) =>
                  setForm({ ...form, actionTag: e.target.value })
                }
                placeholder="Tag (ex: priority-high)"
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
            <Label>Ativa</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RoutingSection() {
  const [tags, setTags] = React.useState<ContactTag[]>([]);
  const [rules, setRules] = React.useState<RoutingRule[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const [t, r] = await Promise.all([fetchContactTags(), fetchRoutingRules()]);
    setTags(t);
    setRules(r);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function removeTag(phone: string) {
    if (!confirm(`Remover marcação do número ${phone}?`)) return;
    await deleteContactTag(phone);
    load();
  }

  async function removeRule(id: number) {
    if (!confirm("Remover esta regra?")) return;
    await deleteRoutingRule(id);
    load();
  }

  async function toggleRule(rule: RoutingRule) {
    await updateRoutingRule(rule.id, { active: !rule.active });
    load();
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted-foreground)]">
        Contatos marcados e regras avaliadas no <code>call.incoming</code> antes
        do auto-reply.
      </p>

      {/* Contact tags */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Contatos marcados ({tags.length})
          </h2>
          <NewContactTagDialog onCreated={load} />
        </div>
        {tags.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-[var(--muted-foreground)] text-center">
              Nenhum contato marcado. Adicione para bloquear ou marcar como
              VIP.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {tags.map((t) => {
                  const meta = (TAG_META as any)[t.tag] ?? {
                    label: t.tag,
                    cls: "bg-zinc-500/15 text-zinc-400",
                    Icon: Shield,
                  };
                  const Icon = meta.Icon;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center",
                          meta.cls
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {formatPhone(t.phone)}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {meta.label}
                          {t.reason ? ` · ${t.reason}` : ""}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTag(t.phone)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Routing rules */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
            <RotateCw className="h-4 w-4" />
            Regras de roteamento ({rules.length})
          </h2>
          <RuleDialog onSaved={load} />
        </div>
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-[var(--muted-foreground)] text-center">
              Nenhuma regra. Crie regras como "rejeitar repeat caller", "VIP →
              prioridade alta", etc.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((r) => (
              <Card key={r.id} className={!r.active ? "opacity-60" : ""}>
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      {r.name}
                      <span className="text-[10px] rounded-full bg-[var(--muted)] px-2 py-0.5 text-[var(--muted-foreground)]">
                        prioridade {r.priority}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      <code className="bg-[var(--muted)]/60 px-1 rounded">
                        if {r.condition?.type}
                        {r.condition?.minCalls !== undefined
                          ? `(${r.condition.minCalls})`
                          : r.condition?.value
                            ? `("${r.condition.value}")`
                            : ""}
                      </code>{" "}
                      →{" "}
                      <code className="bg-[var(--muted)]/60 px-1 rounded">
                        {r.action?.type}
                        {r.action?.tag ? `("${r.action.tag}")` : ""}
                      </code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={r.active}
                      onCheckedChange={() => toggleRule(r)}
                    />
                    <RuleDialog rule={r} onSaved={load} />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRule(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
