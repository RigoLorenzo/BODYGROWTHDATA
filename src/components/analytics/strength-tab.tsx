"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { periodTotals, periodWindow, type Totals } from "@/lib/insights";
import { cn, formatVolume, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";
import { compareContext } from "./compare";
import { formatDecimal, formatHours } from "./format";
import { PeriodBar, PeriodSwipe, firstActivity } from "./period-bar";
import { MetricTiles, TrendChart, type PeriodMetric } from "./period-metrics";
import { usePeriodSelection } from "./period-picker";
import { LIFTED } from "./metrics";
import { Block, EmptyState, Segmented } from "./ui";
import { useActivity } from "./use-activity";

/**
 * Palestra, con la stessa struttura del Riepilogo: la barra del periodo
 * governa i riquadri, il grafico e i muscoli.
 */

const MUSCLES = ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES"];

interface MuscleStats {
  totalSets: number;
  tonnage: number;
  directSets: number;
  effectiveSets: number;
}

interface MuscleFreq {
  count: number;
  daysSince: number | null;
}

function useWeekly() {
  return useQuery<WeeklyAnalytics>({
    queryKey: ["analytics", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=weekly&weeks=8");
      if (!res.ok) throw new Error("Failed to fetch weekly analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Muscoli nel periodo [from, to); senza limiti ("sempre") gli ultimi 10 anni */
function useMuscleStats(from: Date | null, to: Date | null) {
  const fromIso = from?.toISOString() ?? null;
  const toIso = to?.toISOString() ?? null;
  return useQuery<Record<string, MuscleStats>>({
    queryKey: ["analytics", "muscle-stats", fromIso, toIso],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "muscle-stats" });
      if (fromIso) params.set("from", fromIso);
      else params.set("weeks", "520");
      if (toIso) params.set("to", toIso);
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
}

function useMuscleFrequency() {
  return useQuery<Record<string, MuscleFreq>>({
    queryKey: ["analytics", "muscle-frequency"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-frequency&days=14");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ─── Metriche della palestra (barre scure, il colore della palestra) ─── */

const GYM_SESSIONS: PeriodMetric = {
  key: "sessions",
  label: "Allenamenti",
  value: (t) => t.gym,
  display: (v) => ({ value: String(v) }),
  diff: String,
  parts: (t) => ({ primary: t.gym }),
  caption: (v) => formatDecimal(v),
  unit: "allenamenti",
};

const SETS: PeriodMetric = {
  key: "sets",
  label: "Serie",
  value: (t) => t.sets,
  display: (v) => ({ value: v.toLocaleString("it-IT") }),
  diff: (n) => n.toLocaleString("it-IT"),
  parts: (t) => ({ primary: t.sets }),
  caption: (v) => String(Math.round(v)),
  unit: "serie",
};

const GYM_TIME: PeriodMetric = {
  key: "time",
  label: "Tempo",
  value: (t: Totals) => t.gymDuration,
  display: (v) => ({ value: formatHours(v) }),
  diff: formatHours,
  parts: (t) => ({ primary: t.gymDuration / 3600 }),
  caption: (v) => `${formatDecimal(v)}h`,
};

const METRICS = [GYM_SESSIONS, LIFTED, SETS, GYM_TIME];

/* ─── Muscoli ─── */

const MUSCLE_METRICS = [
  { value: "effective", label: "Serie" },
  { value: "tonnage", label: "Peso" },
] as const;
type MuscleMetric = (typeof MUSCLE_METRICS)[number]["value"];

/** Sotto questa quota del muscolo più allenato, il muscolo "resta indietro" */
const BEHIND = 0.35;

function muscleValue(stats: MuscleStats | undefined, metric: MuscleMetric) {
  if (!stats) return 0;
  if (metric === "effective") return stats.effectiveSets ?? 0;
  return stats.tonnage;
}

const formatMuscleValue = (v: number, metric: MuscleMetric) => (metric === "tonnage" ? formatVolume(v) : formatDecimal(v));

/** Da quanto non alleni il muscolo: verde se di recente, rosso se da più di 5 giorni */
function Recency({ freq }: { freq?: MuscleFreq }) {
  const days = freq?.count ? freq.daysSince : null;
  const text = days == null ? "—" : days === 0 ? "oggi" : days === 1 ? "ieri" : `${days}g fa`;
  const tone =
    days == null
      ? "text-muted-foreground"
      : days <= 2
        ? "text-lime-700 dark:text-lime-400"
        : days <= 5
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";
  return <span className={cn("w-12 shrink-0 text-right text-[11px] font-medium tabular-nums", tone)}>{text}</span>;
}

/** Le 8 settimane del muscolo aperto: serie efficaci per settimana */
function MuscleWeeks({ muscle, weekly }: { muscle: string; weekly?: WeeklyAnalytics }) {
  if (!weekly?.weeks.length) return null;
  const color = getMuscleColor(muscle);
  const values = weekly.weeks.map((w) => w.effectiveSetsByMuscle?.[muscle] ?? 0);
  const max = Math.max(1, ...values);
  return (
    <div className="pb-3 pl-4 pt-1">
      <div className="flex h-14 items-end gap-1.5">
        {values.map((v, i) => (
          <div key={weekly.weeks[i].weekStart} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-0.5 text-[9px] tabular-nums text-muted-foreground">{v ? formatDecimal(v) : ""}</span>
            <div
              className="w-full rounded-t"
              style={{ height: v ? `${(v / max) * 100}%` : 3, background: v ? color : "hsl(var(--muted))", opacity: i === values.length - 1 ? 1 : 0.6 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[9px] text-muted-foreground">
        {weekly.weeks.map((w, i) => (
          <span key={w.weekStart} className="flex-1 text-center">
            {i % 2 === 1 ? w.label : ""}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Serie a settimana, ultime 8 settimane</p>
    </div>
  );
}

/**
 * Muscoli nel periodo: una riga per muscolo, dal più allenato. Quelli
 * rimasti indietro hanno un'etichetta; toccando una riga si vedono le sue
 * ultime 8 settimane.
 */
function Muscles({ from, to, weekly }: { from: Date | null; to: Date | null; weekly?: WeeklyAnalytics }) {
  const [metric, setMetric] = useState<MuscleMetric>("effective");
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats, isLoading } = useMuscleStats(from, to);
  const { data: freq } = useMuscleFrequency();

  const rows = MUSCLES.map((m) => ({ muscle: m, value: muscleValue(stats?.[m], metric) })).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Block title="Muscoli" action={<Segmented value={metric} options={MUSCLE_METRICS} onChange={setMetric} size="sm" className="w-40" />}>
      {isLoading && !stats ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !rows.some((r) => r.value > 0) ? (
        <EmptyState>Nessuna serie in questo periodo.</EmptyState>
      ) : (
        <ul className="-my-1">
          {rows.map(({ muscle, value }) => {
            const expanded = open === muscle;
            const behind = value < max * BEHIND;
            return (
              <li key={muscle}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : muscle)}
                  aria-expanded={expanded}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg py-1.5 text-left active:bg-muted/40"
                >
                  <span className="w-24 shrink-0">
                    <span className="block truncate text-sm font-medium">{getMuscleLabel(muscle)}</span>
                    {behind && <span className="block text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Indietro</span>}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: getMuscleColor(muscle) }} />
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {value > 0 ? formatMuscleValue(value, metric) : <span className="text-muted-foreground">—</span>}
                  </span>
                  <Recency freq={freq?.[muscle]} />
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
                </button>
                {expanded && <MuscleWeeks muscle={muscle} weekly={weekly} />}
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}

export function StrengthTab() {
  const { data: items, isLoading } = useActivity();
  const { data: weekly } = useWeekly();
  const now = useMemo(() => new Date(), []);
  const selection = usePeriodSelection(now);
  const { period, anchor } = selection;
  const [metricKey, setMetricKey] = useState(GYM_SESSIONS.key);
  const gym = useMemo(() => (items ?? []).filter((i) => i.kind === "gym"), [items]);
  const first = useMemo(() => firstActivity(gym), [gym]);

  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (!gym.length) return <EmptyState>Ancora nessun allenamento in palestra.</EmptyState>;

  const { current, previous } = periodTotals(gym, period, now, anchor);
  const metric = METRICS.find((m) => m.key === metricKey) ?? GYM_SESSIONS;
  const span = periodWindow(period, anchor, now);

  return (
    <div className="space-y-6">
      <PeriodBar selection={selection} now={now} first={first} pickerItems={gym} />

      <PeriodSwipe selection={selection} now={now} first={first}>
        <MetricTiles
          metrics={METRICS}
          current={current}
          previous={period === "all" ? null : previous}
          ctx={compareContext(period, anchor, now)}
          selected={metric.key}
          onSelect={setMetricKey}
        />
        <TrendChart items={gym} now={now} selection={selection} metric={metric} />
      </PeriodSwipe>

      <Muscles from={span.from} to={span.to} weekly={weekly} />

      <Link href="/records" className="flex h-12 items-center gap-3 rounded-2xl bg-muted/60 px-4 text-sm font-medium active:bg-muted">
        <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
        <span className="flex-1">Record per esercizio</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
