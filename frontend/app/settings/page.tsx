"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  RotateCcw,
  Save,
  AlertCircle,
  Phone,
  UserCog,
  Clock,
  Bot,
  Star,
  MessageCircle,
  Sparkles,
  Settings as SettingsIcon,
  Volume2,
  PhoneIncoming,
  Eye,
  EyeOff,
  KeyRound,
  Shield,
} from "lucide-react";
import {
  fetchSettings,
  updateSettings,
  resetSetting,
  type SettingItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MediaPicker } from "@/components/MediaPicker";
import { MessagesSection } from "@/components/sections/MessagesSection";
import { CallbacksSection } from "@/components/sections/CallbacksSection";
import { BusinessHoursSection } from "@/components/sections/BusinessHoursSection";
import { NpsSection } from "@/components/sections/NpsSection";
import { RoutingSection } from "@/components/sections/RoutingSection";
import { cn } from "@/lib/utils";

type Pending = Record<string, string | number | boolean>;

// Mapeia cada chave a uma categoria + ordem de exibicao
// Categorias com "isCustom" renderizam componente proprio em vez do grid de settings
const CATEGORIES = [
  { id: "calls", label: "Chamadas", icon: Phone },
  { id: "agent", label: "Agente", icon: UserCog },
  { id: "messages", label: "Mensagens", icon: MessageCircle, isCustom: true },
  { id: "callbacks", label: "Callbacks", icon: PhoneIncoming, isCustom: true },
  { id: "hours", label: "Horário", icon: Clock },
  { id: "businessHours", label: "Horários (dias)", icon: Clock, isCustom: true },
  { id: "ivr", label: "IVR", icon: Bot },
  { id: "audio", label: "Áudio (URA)", icon: Volume2 },
  { id: "followup", label: "Follow-up", icon: PhoneIncoming },
  { id: "routing", label: "Roteamento", icon: Shield, isCustom: true },
  { id: "nps", label: "NPS (config)", icon: Star },
  { id: "npsResults", label: "NPS Resultados", icon: Star, isCustom: true },
  { id: "ai", label: "IA", icon: Sparkles },
  { id: "wavoip", label: "Wavoip", icon: SettingsIcon },
  { id: "other", label: "Geral", icon: SettingsIcon },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const CUSTOM_CATEGORIES = new Set<CategoryId>([
  "messages",
  "callbacks",
  "businessHours",
  "npsResults",
  "routing",
]);

// Settings escondidos (gerenciados por outras UIs)
const HIDDEN_KEYS = new Set(["agent_status"]);

function categoryOf(key: string): CategoryId {
  if (key === "reject_calls_default") return "calls";
  if (key.startsWith("call_reject_message")) return "calls";
  if (key.startsWith("agent_busy") || key.startsWith("agent_paused"))
    return "agent";
  if (key.startsWith("outside_hours")) return "hours";
  if (key.startsWith("ivr_")) return "ivr";
  if (key.startsWith("on_accept_audio")) return "audio";
  if (key.startsWith("missed_followup")) return "followup";
  if (key.startsWith("nps_")) return "nps";
  if (key.startsWith("ai_") || key.startsWith("openai_") || key.startsWith("anthropic_"))
    return "ai";
  if (key.startsWith("wavoip_")) return "wavoip";
  return "other";
}

function OpenEnumField({
  item,
  value,
  onChange,
}: {
  item: SettingItem;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  const current = String(value);
  const isInList = (item.enum ?? []).includes(current);
  const [mode, setMode] = React.useState<"list" | "custom">(
    isInList || !current ? "list" : "custom"
  );

  React.useEffect(() => {
    // Se valor externo muda pra algo que esta na lista, volta pro modo list
    if (isInList) setMode("list");
  }, [isInList]);

  if (mode === "list") {
    return (
      <select
        value={isInList ? current : "__custom__"}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setMode("custom");
            // Mantem o valor atual ou limpa
            return;
          }
          onChange(e.target.value);
        }}
        className="h-11 max-w-md w-full rounded-xl border border-[var(--border)] bg-transparent px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wavoip-500"
      >
        {(item.enum ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__custom__">✏️  Outro (digitar manualmente)...</option>
      </select>
    );
  }

  return (
    <div className="flex flex-col gap-1 max-w-md">
      <div className="flex gap-2">
        <Input
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite o valor customizado"
          autoFocus
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setMode("list")}
        >
          Voltar à lista
        </Button>
      </div>
      <p className="text-[10px] text-[var(--muted-foreground)]">
        Valores conhecidos: {(item.enum ?? []).join(" · ")}
      </p>
    </div>
  );
}

function SecretField({
  item,
  value,
  isDirty,
  onChange,
}: {
  item: SettingItem;
  value: string | number | boolean;
  isDirty: boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [show, setShow] = React.useState(false);

  // Quando ja existe valor salvo e nao esta editando -> mostra mascarado
  const hasStored = item.overridden && !isDirty;

  if (hasStored && !editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-mono">
          <KeyRound className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span>{item.valueMasked || String(value) || "********"}</span>
          <span className="ml-auto text-[10px] text-green-400">
            configurado
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={() => {
            setEditing(true);
            setShow(true);
            onChange("");
          }}
        >
          Alterar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type={show ? "text" : "password"}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={item.key.includes("openai") ? "sk-..." : "sk-ant-..."}
        autoComplete="off"
        className="font-mono"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar" : "Mostrar"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function SettingField({
  item,
  value,
  isDirty,
  onChange,
}: {
  item: SettingItem;
  value: string | number | boolean;
  isDirty: boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  if (item.secret) {
    return (
      <SecretField
        item={item}
        value={value}
        isDirty={isDirty}
        onChange={onChange}
      />
    );
  }
  // Detecta chaves de midia pelo nome -> MediaPicker
  if (item.key.includes("audio_url") || item.key.endsWith("_audio")) {
    return (
      <MediaPicker
        value={String(value)}
        accept="audio/*"
        placeholder="https://.../audio.mp3"
        onChange={(url) => onChange(url)}
      />
    );
  }
  if (item.key.includes("image_url")) {
    return (
      <MediaPicker
        value={String(value)}
        accept="image/*"
        placeholder="https://.../imagem.jpg"
        onChange={(url) => onChange(url)}
      />
    );
  }
  if (item.type === "boolean") {
    return (
      <Switch
        checked={Boolean(value)}
        onCheckedChange={(v) => onChange(v)}
      />
    );
  }
  if (item.type === "number") {
    return (
      <Input
        type="number"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="max-w-[200px]"
      />
    );
  }
  // Enum aberto -> select com opcao "Outro..." que revela input livre
  if (item.enum && item.enum.length > 0 && item.enumOpen) {
    return (
      <OpenEnumField item={item} value={value} onChange={onChange} />
    );
  }
  // Enum strict -> dropdown
  if (item.enum && item.enum.length > 0) {
    return (
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 max-w-md w-full rounded-xl border border-[var(--border)] bg-transparent px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wavoip-500"
      >
        {item.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  const isLong = String(value).length > 60 || item.key.includes("message");
  if (isLong) {
    return (
      <Textarea
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    );
  }
  return (
    <Input value={String(value)} onChange={(e) => onChange(e.target.value)} />
  );
}

function SettingRow({
  item,
  currentValue,
  isDirty,
  saving,
  onChange,
  onReset,
}: {
  item: SettingItem;
  currentValue: string | number | boolean;
  isDirty: boolean;
  saving: boolean;
  onChange: (v: string | number | boolean) => void;
  onReset: () => void;
}) {
  const t = useTranslations("settings");
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-medium">{item.key}</code>
            {isDirty && (
              <span className="text-[10px] text-amber-400" title="Modificado">
                ● não salvo
              </span>
            )}
            {item.overridden && !isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400">
                <AlertCircle className="h-3 w-3" />
                {t("overridden")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {item.description}
          </p>
          {item.envVar && (
            <code className="mt-1 inline-block rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
              {item.envVar}
            </code>
          )}
        </div>
        {item.overridden && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onReset}
            disabled={saving}
            aria-label={t("reset")}
            title={t("reset")}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-[var(--muted-foreground)]">
          {t("value")}
        </Label>
        <SettingField
          item={item}
          value={currentValue}
          isDirty={isDirty}
          onChange={onChange}
        />
        {!item.secret && (
          <div className="rounded-lg bg-[var(--muted)]/60 px-3 py-1.5">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {t("default")}
            </p>
            <code className="text-[11px] break-all">
              {String(item.default)}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [items, setItems] = React.useState<SettingItem[]>([]);
  const [pending, setPending] = React.useState<Pending>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<CategoryId>("calls");

  const load = React.useCallback(async () => {
    try {
      const data = await fetchSettings();
      setItems(data);
      setPending({});
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function setLocal(key: string, value: string | number | boolean) {
    setPending((prev) => ({ ...prev, [key]: value }));
  }

  const visibleItems = React.useMemo(
    () => items.filter((i) => !HIDDEN_KEYS.has(i.key)),
    [items]
  );

  // Agrupa por categoria + conta dirty por categoria
  const grouped = React.useMemo(() => {
    const map: Record<CategoryId, SettingItem[]> = {} as any;
    for (const c of CATEGORIES) map[c.id] = [];
    for (const item of visibleItems) {
      const cat = categoryOf(item.key);
      map[cat].push(item);
    }
    return map;
  }, [visibleItems]);

  const dirtyByCategory = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(pending)) {
      const cat = categoryOf(key);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [pending]);

  const totalDirty = Object.keys(pending).length;
  const hasChanges = totalDirty > 0;

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    try {
      await updateSettings(pending);
      await load();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(key: string) {
    setSaving(true);
    try {
      await resetSetting(key);
      setPending((prev) => {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  const activeItems = grouped[activeCategory] || [];

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
          {savedFlash && (
            <span className="rounded-full bg-green-500/15 text-green-400 px-3 py-1 text-xs">
              {t("saved")}
            </span>
          )}
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? tCommon("loading") : `${t("save")} (${totalDirty})`}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {tCommon("loading")}
        </p>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar de categorias */}
          <aside className="lg:w-56 shrink-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isCustom = CUSTOM_CATEGORIES.has(cat.id);
                const count = grouped[cat.id]?.length ?? 0;
                // Esconde categorias settings vazias; mostra sempre as customs
                if (count === 0 && !isCustom) return null;
                const active = activeCategory === cat.id;
                const dirty = dirtyByCategory[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors min-h-[40px] shrink-0",
                      active
                        ? "bg-wavoip-500/10 text-wavoip-500 font-medium"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{cat.label}</span>
                    {!isCustom && (
                      <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums">
                        {count}
                      </span>
                    )}
                    {dirty > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Conteudo da categoria */}
          <section className="flex-1 min-w-0">
            {activeCategory === "messages" ? (
              <MessagesSection />
            ) : activeCategory === "callbacks" ? (
              <CallbacksSection />
            ) : activeCategory === "businessHours" ? (
              <BusinessHoursSection />
            ) : activeCategory === "npsResults" ? (
              <NpsSection />
            ) : activeCategory === "routing" ? (
              <RoutingSection />
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {activeItems.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                      Nenhuma configuração nesta categoria.
                    </CardContent>
                  </Card>
                ) : (
                  activeItems.map((item) => {
                    const currentValue =
                      item.key in pending ? pending[item.key] : item.value;
                    const isDirty = item.key in pending;
                    return (
                      <SettingRow
                        key={item.key}
                        item={item}
                        currentValue={currentValue}
                        isDirty={isDirty}
                        saving={saving}
                        onChange={(v) => setLocal(item.key, v)}
                        onReset={() => handleReset(item.key)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
