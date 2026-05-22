"use client";

import * as React from "react";
import { Star, ThumbsUp, ThumbsDown, Minus, AlertTriangle } from "lucide-react";
import {
  fetchRatings,
  fetchNpsSummary,
  type CallRatingRecord,
  type NpsSummary,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatPhone } from "@/lib/utils";

function scoreCategory(score: number): "promoter" | "neutral" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "neutral";
  return "detractor";
}

function ScoreBadge({ score }: { score: number }) {
  const cat = scoreCategory(score);
  const map = {
    promoter: {
      cls: "bg-green-500/15 text-green-400 border-green-500/30",
      Icon: ThumbsUp,
      label: "Promoter",
    },
    neutral: {
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      Icon: Minus,
      label: "Neutro",
    },
    detractor: {
      cls: "bg-red-500/15 text-red-400 border-red-500/30",
      Icon: ThumbsDown,
      label: "Detractor",
    },
  } as const;
  const { cls, Icon, label } = map[cat];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cls
      )}
    >
      <Icon className="h-3 w-3" />
      {score} · {label}
    </span>
  );
}

function NpsBar({ summary }: { summary: NpsSummary }) {
  if (summary.total === 0) return null;
  const p = summary.promoterPct ?? (summary.promoters / summary.total) * 100;
  const n = summary.neutralPct ?? (summary.neutrals / summary.total) * 100;
  const d = summary.detractorPct ?? (summary.detractors / summary.total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="bg-green-500 h-full"
          style={{ width: `${p}%` }}
          title={`${summary.promoters} promoters (${p.toFixed(1)}%)`}
        />
        <div
          className="bg-amber-500 h-full"
          style={{ width: `${n}%` }}
          title={`${summary.neutrals} neutrals (${n.toFixed(1)}%)`}
        />
        <div
          className="bg-red-500 h-full"
          style={{ width: `${d}%` }}
          title={`${summary.detractors} detractors (${d.toFixed(1)}%)`}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
        <span className="text-green-400">
          {summary.promoters} promoters · {p.toFixed(0)}%
        </span>
        <span className="text-amber-400">
          {summary.neutrals} neutros · {n.toFixed(0)}%
        </span>
        <span className="text-red-400">
          {summary.detractors} detractors · {d.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function NpsSection() {
  const [summary, setSummary] = React.useState<NpsSummary | null>(null);
  const [ratings, setRatings] = React.useState<CallRatingRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<
    "all" | "promoter" | "neutral" | "detractor"
  >("all");

  const load = React.useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        fetchNpsSummary(),
        fetchRatings({ limit: 200 }),
      ]);
      setSummary(s);
      setRatings(r);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const i = setInterval(load, 10_000);
    return () => clearInterval(i);
  }, [load]);

  const filtered = ratings.filter((r) => {
    if (filter === "all") return true;
    return scoreCategory(r.score) === filter;
  });

  const detractors = ratings.filter((r) => scoreCategory(r.score) === "detractor");

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Carregando...</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        Pesquisa de satisfação enviada automaticamente após chamadas atendidas
        (configure em <strong>NPS</strong>).
      </p>

      {/* Cards summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-[var(--muted-foreground)] font-normal uppercase tracking-wide flex items-center gap-1.5">
              <Star className="h-3 w-3" />
              NPS Score
            </CardTitle>
            <div className="text-4xl font-semibold">
              {summary?.nps ?? 0}
              <span className="text-sm text-[var(--muted-foreground)] ml-2">
                / 100
              </span>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-[var(--muted-foreground)] font-normal uppercase tracking-wide">
              Total de respostas
            </CardTitle>
            <div className="text-4xl font-semibold">{summary?.total ?? 0}</div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-[var(--muted-foreground)] font-normal uppercase tracking-wide">
              Média
            </CardTitle>
            <div className="text-4xl font-mono font-semibold">
              {summary?.avg ?? "—"}
            </div>
          </CardHeader>
        </Card>
      </section>

      {/* Barra distribuição */}
      {summary && summary.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <NpsBar summary={summary} />
          </CardContent>
        </Card>
      )}

      {/* Alerta de detractors recentes */}
      {detractors.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {detractors.length} detractor{detractors.length > 1 ? "es" : ""} (notas 0-6)
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "promoter", "neutral", "detractor"] as const).map((f) => {
          const count =
            f === "all"
              ? ratings.length
              : ratings.filter((r) => scoreCategory(r.score) === f).length;
          return (
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
              {f === "all"
                ? "Todas"
                : f === "promoter"
                  ? "Promoters"
                  : f === "neutral"
                    ? "Neutros"
                    : "Detractors"}{" "}
              ({count})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">
            {ratings.length === 0
              ? "Nenhuma resposta NPS ainda. Aguarde uma chamada completada e o cliente responder."
              : "Nenhuma resposta nesta categoria."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {filtered.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 p-3 hover:bg-[var(--muted)]/40"
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                      scoreCategory(r.score) === "promoter"
                        ? "bg-green-500/15 text-green-400"
                        : scoreCategory(r.score) === "neutral"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                    )}
                  >
                    {r.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {formatPhone(r.phone)}
                      </span>
                      <ScoreBadge score={r.score} />
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Chamada #{r.callId} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-sm">{r.comment}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={load}
        className="self-start"
      >
        Atualizar
      </Button>
    </div>
  );
}
