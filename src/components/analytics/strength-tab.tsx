"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatVolume, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";
import { StackedBars } from "./bars";
import { formatDecimal, formatDelta } from "./format";
import { EmptyState, Section, Segmented, Stat } from "./ui";

/**
 * Palestra: il carico settimanale (serie e tonnellaggio) e come si
 * distribuisce sui muscoli. Ultime 8 settimane, le ultime 4 confrontate con
 * le 4 prima.
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

function useMuscleStats() {
  return useQuery<Record<string, MuscleStats>>({
    queryKey: ["analytics", "muscle-stats"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-stats&weeks=8");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
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

/* ─── Carico ─── */

const LOAD_METRICS = [
  { value: "sets", label: "Serie" },
  { value: "tonnage", label: "Tonnellaggio" },
] as const;
type LoadMetric = (typeof LOAD_METRICS)[number]["value"];

const sum = (list: number[]) => list.reduce((s, v) => s + v, 0);

function DeltaLine({ current, previous }: { current: number; previous: number }) {
  const delta = formatDelta(current, previous);
  if (!delta) return null;
  const tone = delta === "=" ? "text-muted-foreground" : delta.startsWith("−") ? "text-red-600 dark:text-red-400" : "text-lime-700 dark:text-lime-400";
  return <span className={cn("font-semibold", tone)}>{delta}</span>;
}

function LoadSection({ data }: { data: WeeklyAnalytics }) {
  const [metric, setMetric] = useState<LoadMetric>("sets");
  const weeks = data.weeks;
  const last = weeks.slice(-4);
  const prev = weeks.slice(-8, -4);
  const sets = sum(last.map((w) => w.workingSets)) / 4;
  const prevSets = sum(prev.map((w) => w.workingSets)) / 4;
  const tonnage = sum(last.map((w) => w.tonnage)) / 4;
  const prevTonnage = sum(prev.map((w) => w.tonnage)) / 4;
  const sessions = sum(last.map((w) => w.sessions)) / 4;
  const prevSessions = sum(prev.map((w) => w.sessions)) / 4;
  const vsPrev = prev.length === 4;

  return (
    <Section title="Carico" hint="Media a settimana, ultime 4 settimane">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Serie" value={Math.round(sets)} detail={vsPrev ? <DeltaLine current={sets} previous={prevSets} /> : undefined} />
        <Stat label="Volume" value={formatVolume(tonnage)} detail={vsPrev ? <DeltaLine current={tonnage} previous={prevTonnage} /> : undefined} />
        <Stat label="Sedute" value={formatDecimal(sessions)} detail={vsPrev ? <DeltaLine current={sessions} previous={prevSessions} /> : undefined} />
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <Segmented value={metric} options={LOAD_METRICS} onChange={setMetric} size="sm" className="mb-4" />
        <StackedBars
          height={120}
          data={weeks.map((w, i) => ({
            key: w.weekStart,
            label: w.label,
            primary: metric === "sets" ? w.workingSets : w.tonnage,
            caption: metric === "sets" ? (w.workingSets ? String(w.workingSets) : undefined) : w.tonnage ? formatVolume(w.tonnage) : undefined,
            highlight: i === weeks.length - 1,
          }))}
          labelEvery={2}
        />
      </div>
    </Section>
  );
}

/* ─── Muscoli ─── */

const MUSCLE_METRICS = [
  { value: "effective", label: "Serie efficaci" },
  { value: "direct", label: "Dirette" },
  { value: "tonnage", label: "Volume" },
] as const;
type MuscleMetric = (typeof MUSCLE_METRICS)[number]["value"];

const METRIC_HINT: Record<MuscleMetric, string> = {
  effective: "Serie pesate per contributo del muscolo e vicinanza al cedimento",
  direct: "Serie in cui il muscolo è il principale",
  tonnage: "Volume Load attribuito al muscolo",
};

function muscleValue(stats: MuscleStats | undefined, metric: MuscleMetric) {
  if (!stats) return 0;
  if (metric === "effective") return stats.effectiveSets ?? 0;
  if (metric === "direct") return stats.directSets ?? stats.totalSets;
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
      <p className="mt-1 text-[11px] text-muted-foreground">Serie efficaci a settimana</p>
    </div>
  );
}

function MuscleSection({ weekly }: { weekly?: WeeklyAnalytics }) {
  const [metric, setMetric] = useState<MuscleMetric>("effective");
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats, isLoading } = useMuscleStats();
  const { data: freq } = useMuscleFrequency();

  const rows = MUSCLES.map((m) => ({ muscle: m, value: muscleValue(stats?.[m], metric) })).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Section title="Muscoli" hint="Ultime 8 settimane · tocca un muscolo per il dettaglio">
      <Segmented value={metric} options={MUSCLE_METRICS} onChange={setMetric} size="sm" />
      <p className="mb-3 mt-2 text-[11px] text-muted-foreground">{METRIC_HINT[metric]}</p>
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
        <div className="flex items-center gap-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground" aria-hidden>
          <span className="flex-1" />
          <span className="w-12 text-right">Totale</span>
          <span className="w-12 text-right">Ultimo</span>
          <span className="w-3.5" />
        </div>
        <ul>
          {rows.map(({ muscle, value }) => {
            const expanded = open === muscle;
            return (
              <li key={muscle} className="border-b border-border/40 last:border-0">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : muscle)}
                  aria-expanded={expanded}
                  className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left active:bg-muted/40"
                >
                  <span className="w-20 shrink-0 truncate text-xs font-medium">{getMuscleLabel(muscle)}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(value / max) * 100}%`, background: getMuscleColor(muscle) }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
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
        </>
      )}
    </Section>
  );
}

export function StrengthTab() {
  const { data: weekly, isLoading } = useWeekly();
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  const hasGym = !!weekly?.weeks.some((w) => w.sessions > 0);
  return (
    <div className="space-y-5">
      {weekly && hasGym ? <LoadSection data={weekly} /> : <EmptyState>Nessun allenamento in palestra nelle ultime 8 settimane.</EmptyState>}
      <MuscleSection weekly={weekly} />
      <Link href="/records" className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card px-4 py-3.5 active:bg-muted/50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Trophy className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">Record per esercizio</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
