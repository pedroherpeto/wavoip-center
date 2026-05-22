"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AgentStatusToggle } from "@/components/AgentStatusToggle";
import { CallbackButton } from "@/components/CallbackButton";
import { fetchCalls, type CallRecord } from "@/lib/api";
import { formatDuration, formatPhone, initials } from "@/lib/utils";

export default function DashboardPage() {
  const tDash = useTranslations("dashboard");
  const tAgent = useTranslations("agent");

  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchCalls({ limit: 50 })
      .then(setCalls)
      .catch((err) => console.error("[dashboard] fetchCalls", err))
      .finally(() => setLoading(false));
  }, []);

  const stats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = calls.filter(
      (c) => new Date(c.startedAt).getTime() >= today.getTime()
    );
    // "missed" inclui status missed + rejected (chamadas nao atendidas)
    const missed = todays.filter(
      (c) => c.status === "missed" || c.status === "rejected"
    );
    const durations = todays
      .map((c) => c.durationSec || 0)
      .filter((d) => d > 0);
    const avg = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    return { total: todays.length, missed: missed.length, avg };
  }, [calls]);

  const recentMissed = calls
    .filter((c) => c.status === "missed" || c.status === "rejected")
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{tDash("title")}</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          {tDash("subtitle")}
        </p>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
          {tAgent("status")}
        </h2>
        <AgentStatusToggle />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>{tDash("totalCalls")}</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{tDash("missedCalls")}</CardDescription>
            <CardTitle className="text-3xl text-red-500">
              {stats.missed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{tDash("avgDuration")}</CardDescription>
            <CardTitle className="text-3xl font-mono">
              {formatDuration(stats.avg)}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      {recentMissed.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-[var(--muted-foreground)] mb-2">
            {tDash("recentMissed")}
          </h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {recentMissed.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 px-4 h-[64px]"
                  >
                    <div className="h-10 w-10 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center text-sm font-semibold">
                      {initials(c.contactName || c.fromNumber)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {c.contactName || formatPhone(c.fromNumber)}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {new Date(c.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <CallbackButton
                      phone={c.fromNumber}
                      contactName={c.contactName ?? undefined}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
