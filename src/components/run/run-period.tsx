"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Target } from "lucide-react";
import { Delta } from "@/components/analytics/delta";
import { formatDecimal, formatDelta } from "@/components/analytics/format";
import { HeadlineNumber, KpiRow, PeriodCard, previousLabel, type PeriodSelection } from "@/components/analytics/period-card";
import { PeriodChart, type ChartMetric, type DayTone } from "@/components/analytics/period-chart";
import type { ActivityItem } from "@/lib/insights";
import { formatDuration, formatKm, formatPace } from "@/lib/run/format";
import { runPeriod, weeksOnGoal, type RunEntry } from "@/lib/run/period";
import { cn } from "@/lib/utils";
import type { RunStats } from "./types";

/** Le corse dal server, con le date pronte */
export function useRunHistory(stats: RunStats): RunEntry[] {
  return useMemo(() => stats.history.map((r) => ({ ...r, startedAt: new Date(r.startedAt) })), [stats.history]);
}

/** Le corse come attività: le usano il grafico condiviso e il selettore dei mesi */
export function useRunItems(runs: RunEntry[]): ActivityItem[] {
  return useMemo(
    () =>
      runs.map((r) => ({
        id: r.id,
        startedAt: r.startedAt,
        kind: "run" as const,
        duration: r.movingTime,
        volume: 0,
        sets: 0,
        distance: r.distance,
        title: "",
        runId: r.id,
      })),
    [runs]
  );
}

/** Secondi al km in meno = più veloce: freccia e parole, niente segni da interpretare */
function PaceChange({ seconds }: { seconds: number | null }) {
  if (!seconds) return null;
  const faster = seconds < 0;
  const Icon = faster ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", faster ? "text-lime-400 dark:text-lime-600" : "text-red-300 dark:text-red-600")}>
      <Icon className="h-[1.1em] w-[1.1em]" aria-hidden />
      {Math.abs(seconds)}″ {faster ? "più veloce" : "più lento"}
    </span>
  );
}

/**
 * Il periodo scelto (settimana, mese, anno, sempre): km in grande col
 * confronto, l'obiettivo settimanale e tre numeri. Stessa card di Analytics.
 */
export function RunPeriodHero({
  stats,
  runs,
  items,
  now,
  selection,
}: {
  stats: RunStats;
  runs: RunEntry[];
  items: ActivityItem[];
  now: Date;
  selection: PeriodSelection;
}) {
  const { period, anchor } = selection;
  const { current, previous, window: span, paceChange } = runPeriod(runs, period, anchor, now);
  const first = runs.length ? runs[runs.length - 1].startedAt : null;
  const compare = period === "all" ? null : previous;

  const goal = stats.settings.weeklyRunKmGoal ? stats.settings.weeklyRunKmGoal * 1000 : null;
  const showGoal = period === "week" && span.isCurrent && !!goal;
  const progress = showGoal ? Math.min(1, current.distance / goal!) : 0;
  // Su mese, anno e sempre: in quante settimane hai centrato l'obiettivo
  const onGoal = goal && period !== "week" ? weeksOnGoal(runs, span, now, goal) : null;

  return (
    <PeriodCard selection={selection} now={now} first={first} pickerItems={items}>
      <HeadlineNumber
        value={formatKm(current.distance)}
        unit="km"
        caption={
          showGoal
            ? progress >= 1
              ? `Obiettivo di ${formatKm(goal!)} km raggiunto`
              : `su ${formatKm(goal!)} km · ne mancano ${formatKm(goal! - current.distance)}`
            : "di corsa"
        }
        delta={compare && <Delta inverse value={formatDelta(current.distance, compare.distance)} />}
        compareLabel={compare && `vs ${previousLabel(period, anchor, now)} (${formatKm(compare.distance)})`}
      />

      {showGoal && (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-background/20"
          role="progressbar"
          aria-label="Obiettivo settimanale"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-lime-400 transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      <KpiRow
        items={[
          { label: "Corse", value: current.runs, detail: compare && <Delta inverse value={formatDelta(current.runs, compare.runs)} /> },
          {
            label: "Tempo",
            value: current.movingTime ? formatDuration(current.movingTime) : "—",
            detail: compare && <Delta inverse value={formatDelta(current.movingTime, compare.movingTime)} />,
          },
          { label: "Ritmo", value: formatPace(current.avgPace), unit: "/km", detail: compare && <PaceChange seconds={paceChange} /> },
        ]}
      />

      {current.runs > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
          <span>
            Più lunga <span className="font-semibold tabular-nums">{formatKm(current.longest)} km</span>
          </span>
          <span>
            Media <span className="font-semibold tabular-nums">{formatKm(current.distance / current.runs)} km</span>
          </span>
          {current.elevationGain > 0 && (
            <span>
              Dislivello <span className="font-semibold tabular-nums">{current.elevationGain} m</span>
            </span>
          )}
        </p>
      )}

      {onGoal && onGoal.total > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs">
          <Target className="h-3.5 w-3.5 text-lime-400 dark:text-lime-600" aria-hidden />
          <span className="opacity-70">Obiettivo {formatKm(goal!)} km centrato in</span>
          <span className="font-semibold tabular-nums">
            {onGoal.hit}/{onGoal.total} settimane
          </span>
        </p>
      )}
    </PeriodCard>
  );
}

/** Km in verde, come la corsa in tutta l'app */
const METRICS: ChartMetric[] = [
  { value: "km", label: "Km", parts: (b) => ({ primary: 0, secondary: b.distance / 1000 }), format: (v) => formatDecimal(v) },
];

/** Nel calendario: più è acceso il verde, più km quel giorno */
const runDayTone: DayTone = (sessions) => {
  const km = sessions.reduce((s, r) => s + r.distance, 0) / 1000;
  if (km <= 0) return { className: "bg-lime-500/30 text-foreground" };
  if (km < 5) return { className: "bg-lime-500/45 text-foreground" };
  if (km < 10) return { className: "bg-lime-500/75 text-zinc-950" };
  return { className: "bg-lime-500 text-zinc-950" };
};

function CalendarLegend() {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      Meno km
      {["bg-lime-500/45", "bg-lime-500/75", "bg-lime-500"].map((c) => (
        <span key={c} className={cn("h-2.5 w-2.5 rounded-sm", c)} aria-hidden />
      ))}
      Più km
    </span>
  );
}

/** Lo stesso grafico sincronizzato di Analytics: segue il periodo della card */
export function RunPeriodChart({ items, now, selection }: { items: ActivityItem[]; now: Date; selection: PeriodSelection }) {
  return (
    <PeriodChart
      items={items}
      now={now}
      selection={selection}
      metrics={METRICS}
      dayTone={runDayTone}
      legend={selection.period === "month" ? <CalendarLegend /> : <span className="text-xs text-muted-foreground">Km di corsa</span>}
    />
  );
}
