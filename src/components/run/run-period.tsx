"use client";

import { useMemo, useState } from "react";
import { compareContext } from "@/components/analytics/compare";
import { formatDecimal, formatHours } from "@/components/analytics/format";
import { Facts, Frequency, type DayTone, type Fact } from "@/components/analytics/frequency";
import { KM } from "@/components/analytics/metrics";
import { PeriodBar, PeriodSwipe, type PeriodSelection } from "@/components/analytics/period-bar";
import { MetricTiles, TrendChart, type PeriodMetric } from "@/components/analytics/period-metrics";
import { Block } from "@/components/analytics/ui";
import { periodConsistency, periodTotals, type ActivityItem } from "@/lib/insights";
import { formatKm, formatPace } from "@/lib/run/format";
import { runPeriod, weeksOnGoal, type RunEntry } from "@/lib/run/period";
import { cn } from "@/lib/utils";
import type { RunStats } from "./types";

/** Le corse dal server, con le date pronte */
export function useRunHistory(stats: RunStats): RunEntry[] {
  return useMemo(() => stats.history.map((r) => ({ ...r, startedAt: new Date(r.startedAt) })), [stats.history]);
}

/** Le corse come attività: le usano grafico, costanza e selettore dei mesi */
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

/* ─── Metriche della corsa (barre verdi, il colore della corsa) ─── */

const RUNS: PeriodMetric = {
  key: "runs",
  label: "Uscite",
  value: (t) => t.runs,
  display: (v) => ({ value: String(v) }),
  diff: String,
  parts: (t) => ({ primary: 0, secondary: t.runs }),
  caption: (v) => formatDecimal(v),
  unit: "uscite",
};

const RUN_TIME: PeriodMetric = {
  key: "time",
  label: "Tempo",
  value: (t) => t.runDuration,
  display: (v) => ({ value: formatHours(v) }),
  diff: formatHours,
  parts: (t) => ({ primary: 0, secondary: t.runDuration / 3600 }),
  caption: (v) => `${formatDecimal(v)}h`,
};

/** Minuti per km: si legge, non si sceglie per il grafico (barre più alte = più lento confonderebbe) */
const PACE: PeriodMetric = {
  key: "pace",
  label: "Min per km",
  value: (t) => (t.distance > 0 ? t.runDuration / (t.distance / 1000) : 0),
  display: (v) => ({ value: formatPace(v || null) }),
  diff: (n) => `${Math.round(n)} sec`,
  lowerIsBetter: true,
};

const METRICS = [{ ...KM, label: "Km" }, RUNS, RUN_TIME, PACE];

/** Nel calendario: più è acceso il verde, più km quel giorno */
const runDayTone: DayTone = (sessions) => {
  const km = sessions.reduce((s, r) => s + r.distance, 0) / 1000;
  if (km < 5) return { className: "bg-run/40 text-foreground" };
  if (km < 10) return { className: "bg-run/70 text-brand-foreground" };
  return { className: "bg-run text-brand-foreground" };
};

/** Avanzamento verso l'obiettivo della settimana, dentro il riquadro dei km */
function GoalBar({ distance, goal, active }: { distance: number; goal: number; active: boolean }) {
  const progress = Math.min(1, distance / goal);
  return (
    <span className="mt-2 block">
      <span
        className={cn("block h-1.5 overflow-hidden rounded-full", active ? "bg-background/20" : "bg-foreground/10")}
        role="progressbar"
        aria-label="Obiettivo settimanale"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span className="block h-full rounded-full bg-run" style={{ width: `${progress * 100}%` }} />
      </span>
      <span className={cn("mt-1 block text-[11px]", active ? "text-background/70" : "text-muted-foreground")}>
        {progress >= 1 ? "obiettivo raggiunto" : `obiettivo ${formatKm(goal)} km`}
      </span>
    </span>
  );
}

/**
 * La corsa per periodo, con la stessa struttura del Riepilogo: barra del
 * periodo, riquadri (quello scelto guida il grafico), poi la costanza.
 */
export function RunProgress({ stats, runs, now, selection }: { stats: RunStats; runs: RunEntry[]; now: Date; selection: PeriodSelection }) {
  const { period, anchor } = selection;
  const items = useRunItems(runs);
  const [metricKey, setMetricKey] = useState(KM.key);
  const first = runs.length ? runs[runs.length - 1].startedAt : null;

  const { current, previous } = periodTotals(items, period, now, anchor);
  const detail = runPeriod(runs, period, anchor, now);
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const goal = stats.settings.weeklyRunKmGoal ? stats.settings.weeklyRunKmGoal * 1000 : null;
  const goalThisWeek = period === "week" && detail.window.isCurrent && goal;
  const onGoal = goal && period !== "week" ? weeksOnGoal(runs, detail.window, now, goal) : null;
  const consistency = periodConsistency(items, period, anchor, now);

  // Con una sola uscita più lunga e media coincidono col totale: niente da aggiungere
  const runFacts: Fact[] = detail.current.runs > 1
    ? [
        { label: "Più lunga", value: formatKm(detail.current.longest), detail: "km" },
        { label: "Media per uscita", value: formatKm(detail.current.distance / detail.current.runs), detail: "km" },
        ...(detail.current.elevationGain > 0 ? [{ label: "Dislivello", value: detail.current.elevationGain, detail: "metri" }] : []),
      ]
    : [];
  const frequencyFacts: Fact[] = [
    { label: "Giorni di corsa", value: current.activeDays },
    ...(period === "week" ? [] : [{ label: "A settimana", value: formatDecimal(consistency.avgPerWeek), detail: "uscite" }]),
    ...(onGoal && onGoal.total > 0 ? [{ label: "Obiettivo", value: `${onGoal.hit}/${onGoal.total}`, detail: "settimane centrate" }] : []),
  ];

  return (
    <>
      <PeriodBar selection={selection} now={now} first={first} pickerItems={items} />

      <PeriodSwipe selection={selection} now={now} first={first}>
        <MetricTiles
          metrics={METRICS}
          current={current}
          previous={period === "all" ? null : previous}
          ctx={compareContext(period, anchor, now)}
          selected={metric.key}
          onSelect={setMetricKey}
          extra={(key, active) => (key === KM.key && goalThisWeek ? <GoalBar distance={current.distance} goal={goal} active={active} /> : null)}
        />
        <TrendChart items={items} now={now} selection={selection} metric={metric} empty={{ label: "Aggiungi una corsa", href: "/run/new" }} />
        {runFacts.length > 0 && (
          <div className="mt-6">
            <Facts facts={runFacts} />
          </div>
        )}
      </PeriodSwipe>

      <Block title="Costanza">
        <Frequency items={items} period={period} anchor={anchor} now={now} tone={runDayTone} weekClass="bg-run" facts={frequencyFacts} />
      </Block>
    </>
  );
}
