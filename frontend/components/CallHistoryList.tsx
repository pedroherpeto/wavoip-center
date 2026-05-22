"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Phone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CallbackButton } from "@/components/CallbackButton";
import {
  formatDuration,
  formatPhone,
  initials,
  cn,
} from "@/lib/utils";
import type { CallRecord } from "@/lib/api";

type Row =
  | { type: "header"; key: string; label: string }
  | { type: "call"; key: string; call: CallRecord };

function groupByDay(
  calls: CallRecord[],
  labels: { today: string; yesterday: string }
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: CallRecord[] }[] = [];
  const map = new Map<string, CallRecord[]>();

  for (const c of calls) {
    const d = new Date(c.startedAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  const sortedKeys = Array.from(map.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  for (const key of sortedKeys) {
    const d = new Date(key);
    let label: string;
    if (d.getTime() === today.getTime()) label = labels.today;
    else if (d.getTime() === yesterday.getTime()) label = labels.yesterday;
    else label = d.toLocaleDateString();
    groups.push({ label, items: map.get(key)! });
  }
  return groups;
}

function DirectionIcon({ call }: { call: CallRecord }) {
  if (call.status === "missed") {
    return <PhoneMissed className="h-4 w-4 text-red-500" />;
  }
  if (call.direction === "incoming") {
    return <PhoneIncoming className="h-4 w-4 text-wavoip-500" />;
  }
  return <PhoneOutgoing className="h-4 w-4 text-blue-400" />;
}

export function CallHistoryList({ calls }: { calls: CallRecord[] }) {
  const tCalls = useTranslations("calls");
  const tCommon = useTranslations("common");

  const rows = React.useMemo<Row[]>(() => {
    const groups = groupByDay(calls, {
      today: tCalls("today"),
      yesterday: tCalls("yesterday"),
    });
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ type: "header", key: `h-${g.label}`, label: g.label });
      for (const c of g.items) {
        out.push({ type: "call", key: `c-${c.id}`, call: c });
      }
    }
    return out;
  }, [calls, tCalls]);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].type === "header" ? 40 : 72),
    overscan: 8,
  });

  if (!calls.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--muted-foreground)]">
        <Phone className="h-10 w-10 opacity-50" />
        <p>{tCommon("empty")}</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-[calc(100vh-180px)] overflow-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((vItem) => {
          const row = rows[vItem.index];
          return (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={vItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vItem.start}px)`,
              }}
            >
              {row.type === "header" ? (
                <div className="px-4 py-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {row.label}
                </div>
              ) : (
                <CallRow call={row.call} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CallRow({ call }: { call: CallRecord }) {
  const name = call.contactName || formatPhone(call.fromNumber);
  const time = new Date(call.startedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 lg:px-4 h-[72px] border-b hover:bg-[var(--muted)]/40 transition-colors"
      )}
    >
      <div className="h-11 w-11 rounded-full bg-wavoip-500/15 text-wavoip-500 flex items-center justify-center font-semibold shrink-0">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <DirectionIcon call={call} />
          <span className="truncate font-medium">{name}</span>
        </div>
        <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 mt-0.5">
          <span>{time}</span>
          {call.durationSec ? (
            <>
              <span>·</span>
              <span>{formatDuration(call.durationSec)}</span>
            </>
          ) : null}
        </div>
      </div>
      <CallbackButton
        phone={call.fromNumber}
        contactName={call.contactName ?? undefined}
      />
    </div>
  );
}
