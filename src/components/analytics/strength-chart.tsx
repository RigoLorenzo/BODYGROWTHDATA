"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDecimal } from "./format";
import { EmptyState, Section, Stat } from "./ui";

interface ExerciseSummary {
  id: string;
  name: string;
  muscle: string | null;
  sessions: number;
  lastDate: string;
  bestOneRM: number;
  currentOneRM: number | null;
  changePercent: number | null;
}

interface HistoryPoint {
  date: string;
  maxWeight: number;
  maxReps: number;
  oneRM: number;
}

const kg = (v: number) => `${formatDecimal(v)} kg`;

function ChangeBadge({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        value > 0
          ? "bg-lime-500/15 text-lime-700 dark:text-lime-400"
          : value < 0
            ? "bg-red-500/10 text-red-600 dark:text-red-400"
            : "bg-muted text-muted-foreground"
      )}
    >
      {value > 0 ? "+" : value < 0 ? "−" : ""}
      {formatDecimal(Math.abs(value))}%
    </span>
  );
}

/** Esercizi con la variazione del massimale stimato nelle ultime 8 settimane */
function Movers({ exercises, onSelect }: { exercises: ExerciseSummary[]; onSelect: (id: string) => void }) {
  const ranked = exercises
    .filter((e) => e.changePercent != null)
    .sort((a, b) => b.changePercent! - a.changePercent!)
    .slice(0, 6);
  if (!ranked.length) return null;
  return (
    <Section title="Forza: chi cresce" hint="Massimale stimato, ultime 8 settimane">
      <ul className="divide-y divide-border/50">
        {ranked.map((e) => (
          <li key={e.id}>
            <button onClick={() => onSelect(e.id)} className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-70">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{e.name}</span>
                <span className="text-xs text-muted-foreground">
                  {e.currentOneRM != null ? kg(e.currentOneRM) : "–"} · record {kg(e.bestOneRM)}
                </span>
              </span>
              <ChangeBadge value={e.changePercent!} />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Progressione nel tempo dell'esercizio scelto tra quelli che fai davvero */
export function StrengthChart() {
  const { data: exercises, isLoading } = useQuery<ExerciseSummary[]>({
    queryKey: ["analytics", "exercises"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/exercises");
      if (!res.ok) throw new Error("Failed to fetch exercises");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? exercises?.[0]?.id ?? null;
  const selected = exercises?.find((e) => e.id === selectedId);

  const { data: history, isLoading: loadingHistory } = useQuery<HistoryPoint[]>({
    queryKey: ["strength-history", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/exercise/${selectedId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedId,
  });

  if (isLoading) return <Skeleton className="h-80 rounded-3xl" />;
  if (!exercises?.length) return <EmptyState>Completa qualche allenamento con i pesi per vedere la progressione.</EmptyState>;

  const choices = exercises.slice(0, 10);
  const select = (id: string) => {
    setPicked(id);
    document.getElementById("strength-chart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      <Movers exercises={exercises} onSelect={select} />

      <section id="strength-chart" className="scroll-mt-4 rounded-3xl border border-border/60 bg-card p-5">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Progressione</h2>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {(choices.some((c) => c.id === selectedId) || !selected ? choices : [selected, ...choices]).map((e) => (
            <button
              key={e.id}
              onClick={() => setPicked(e.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-sm",
                e.id === selectedId ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
              )}
            >
              {e.name}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Attuale" value={selected.currentOneRM != null ? formatDecimal(selected.currentOneRM) : "–"} unit="kg" />
            <Stat label="Record" value={formatDecimal(selected.bestOneRM)} unit="kg" />
            <Stat label="Sedute" value={selected.sessions} />
          </div>
        )}

        <div className="mt-4">
          {loadingHistory ? (
            <Skeleton className="h-52 rounded-2xl" />
          ) : history && history.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={history} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 5", "dataMax + 5"]}
                  tickFormatter={(v) => `${Math.round(v)}`}
                />
                <Tooltip
                  formatter={(v: number, name) => [kg(v), name]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="oneRM" stroke="hsl(var(--foreground))" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Massimale stimato" />
                <Line type="monotone" dataKey="maxWeight" stroke="#84cc16" strokeWidth={2} dot={false} isAnimationActive={false} name="Peso massimo" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nessuna serie con peso per questo esercizio.</p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-foreground" /> Massimale stimato
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-lime-500" /> Peso massimo
          </span>
        </div>
      </section>
    </div>
  );
}
