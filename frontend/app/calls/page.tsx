"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CallHistoryList } from "@/components/CallHistoryList";
import { fetchCalls, type CallRecord } from "@/lib/api";

export default function CallsPage() {
  const t = useTranslations("calls");
  const [calls, setCalls] = React.useState<CallRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchCalls({ limit: 200 })
      .then(setCalls)
      .catch((err) => console.error("[calls] fetch", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("history")}</h1>
      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">...</p>
      ) : (
        <CallHistoryList calls={calls} />
      )}
    </div>
  );
}
