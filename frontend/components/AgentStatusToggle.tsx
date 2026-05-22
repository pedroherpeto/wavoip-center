"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useWebphoneStore, type AgentStatus } from "@/lib/store/webphone-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AgentStatus; dot: string }[] = [
  { value: "available", dot: "bg-wavoip-500" },
  { value: "busy", dot: "bg-red-500" },
  { value: "paused", dot: "bg-amber-500" },
];

export function AgentStatusToggle() {
  const t = useTranslations("agent");
  const status = useWebphoneStore((s) => s.agentStatus);
  const setStatus = useWebphoneStore((s) => s.setAgentStatus);
  const [syncing, setSyncing] = React.useState(false);

  // Carrega status do backend ao montar
  React.useEffect(() => {
    api
      .get("/settings/agent_status")
      .then((res) => {
        const v = (res.data?.value as AgentStatus) ?? "available";
        if (v && v !== status) setStatus(v);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeStatus(next: AgentStatus) {
    if (next === status) return;
    setStatus(next);
    setSyncing(true);
    try {
      await api.put("/settings/agent_status", { value: next });
    } catch (e) {
      console.error("[AgentStatusToggle] sync failed", e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("status")}
      className={cn(
        "grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[var(--card)] border transition-opacity",
        syncing && "opacity-70"
      )}
    >
      {OPTIONS.map((opt) => {
        const active = status === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => changeStatus(opt.value)}
            disabled={syncing}
            className={cn(
              "flex items-center justify-center gap-2 min-h-[44px] rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-wavoip-500/10 text-wavoip-500"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            )}
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", opt.dot)} />
            {t(opt.value)}
          </button>
        );
      })}
    </div>
  );
}
