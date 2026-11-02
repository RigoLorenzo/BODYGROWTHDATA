"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { StackedBars } from "@/components/analytics/bars";
import {
  BackToToday,
  PERIOD_OPTIONS,
  PeriodNavigator,
  PeriodPickerDialog,
  usePeriodSelection,
} from "@/components/analytics/period-picker";
import { Section, Segmented } from "@/components/analytics/ui";
import type { ActivityItem, Period } from "@/lib/insights";
import { formatDuration, formatKm, formatPace } from "@/lib/run/format";
import { monthlyRunTotals, runPeriod, type RunEntry } from "@/lib/run/period";
import { cn } from "@/lib/utils";
import type { RunStats } from "./types";
import { WeeklyChart } from "./weekly-chart";

const PREVIOUS: Record<Exclude<Period, "all">, [current: string, past: string]> = {
  week: ["settimana scorsa", "settimana prima"],
  month: ["mese scorso", "mese prima"],
  year: ["anno scorso", "anno prima"],
};

/** Le corse dal server, con le date pronte */
export function useRunHistory(stats: RunStats): RunEntry[] {
  return useMemo(() => stats.history.map((r) => ({ ...r, startedAt: new Date(r.startedAt) })), [stats.history]);
}

function Cell({ label, value, unit, detail, tone }: { label: string; value: string | number; unit?: string; detail?: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider opacity-60">{label}</p>
      <p className="truncate font-display text-xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium opacity-60">{unit}</span>}
      </p>
      {detail && (
        <p className={cn("text-[11px] font-semibold tabular-nums", tone === "up" ? "text-lime-400 dark:text-lime-600" : tone === "down" ? "text-red-300 dark:text-red-600" : "opacity-60")}>
          {detail}
        </p>
      )}
    </div>
  );
}

/**
 * Il periodo scelto (settimana, mese, anno, sempre): km, ritmo e confronto
 * col periodo prima. Frecce e scelta del mese come in Analytics.
 */
export function RunPeriodHero({ stats, runs, now }: { stats: RunStats; runs: RunEntry[]; now: Date }) {
  const { period, anchor, setPeriod, setAnchor } = usePeriodSelection(now, "week");
  const [pickerOpen, setPickerOpen] = useState(false);
  const data = runPeriod(runs, period, anchor, now);
  const { current, previous, window: span } = data;
  const first = runs.length ? runs[runs.length - 1].startedAt : null;
  // Il selettore dei mesi colora i mesi in base alle corse
  const pickerItems = useMemo<ActivityItem[]>(
    () => runs.map((r) => ({ id: r.id, startedAt: r.startedAt, kind: "run", duration: r.movingTime, volume: 0, sets: 0, distance: r.distance, title: "" })),
    [runs]
  );

  const goal = stats.settings.weeklyRunKmGoal ? stats.settings.weeklyRunKmGoal * 1000 : null;
  const showGoal = period === "week" && span.isCurrent && goal;
  const progress = showGoal ? Math.min(1, current.distance / goal) : 0;

  const change = data.distanceChange;
  const pace = data.paceChange;

  return (
    <section className="rounded-3xl bg-foreground p-5 text-background">
      <Segmented
        value={period}
        options={PERIOD_OPTIONS}
        onChange={setPeriod}
        size="sm"
        className="bg-background/15 [&_[aria-selected=false]]:text-background/70 [&_[aria-selected=true]]:bg-background [&_[aria-selected=true]]:text-foreground"
      />
      <PeriodNavigator period={period} anchor={anchor} now={now} first={first} onChange={setAnchor} onOpenPicker={() => setPickerOpen(true)} />

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-display text-6xl font-bold leading-none tabular-nums">
          {formatKm(current.distance)}
          <span className="ml-1 text-xl font-semibold opacity-60">{showGoal ? `/ ${formatKm(goal)} km` : "km"}</span>
        </p>
        {change != null && period !== "all" && (
          <div className="shrink-0 text-right">
            <p className={cn("font-display text-2xl font-bold", change < 0 ? "text-red-300 dark:text-red-600" : "text-lime-400 dark:text-lime-600")}>
              {change === 0 ? "=" : `${change > 0 ? "+" : "−"}${Math.abs(change)}%`}
            </p>
            <p className="text-xs opacity-70">
              vs {PREVIOUS[period][span.isCurrent ? 0 : 1]} ({formatKm(previous!.distance)})
            </p>
          </div>
        )}
      </div>

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

      {/* Tre numeri chiave; il resto in una riga sola, solo se c'è */}
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-background/15 pt-4">
        <Cell label="Corse" value={current.runs} />
        <Cell label="Tempo" value={current.movingTime ? formatDuration(current.movingTime) : "—"} />
        <Cell
          label="Ritmo"
          value={formatPace(current.avgPace)}
          unit="/km"
          // Meno secondi al km = più veloce
          detail={pace ? `${pace < 0 ? "−" : "+"}${Math.abs(pace)}s/km` : undefined}
          tone={pace ? (pace < 0 ? "up" : "down") : undefined}
        />
      </div>
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

      {!span.isCurrent && <BackToToday onClick={() => setAnchor(now)} />}

      {(period === "month" || period === "year") && (
        <PeriodPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          period={period}
          anchor={anchor}
          now={now}
          first={first}
          items={pickerItems}
          onSelect={setAnchor}
        />
      )}
    </section>
  );
}

/** Km degli ultimi 12 mesi: tocca un mese per aprirlo in alto */
function MonthlyKm({ runs, now }: { runs: RunEntry[]; now: Date }) {
  const { period, anchor, select } = usePeriodSelection(now, "week");
  const months = monthlyRunTotals(runs, 12, now);
  const selected = period === "month" ? format(anchor, "yyyy-MM") : null;
  const open = (key: string) => {
    const month = months.find((m) => m.key === key);
    if (!month) return;
    select("month", month.start);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };
  return (
    <StackedBars
      height={140}
      labelEvery={2}
      onSelect={open}
      data={months.map((m) => ({
        key: m.key,
        label: format(m.start, "MMM", { locale: it }),
        primary: 0,
        secondary: Math.round(m.distance / 100) / 10,
        caption: m.distance ? String(Math.round(m.distance / 1000)) : undefined,
        highlight: m.key === selected,
      }))}
    />
  );
}

const TREND_VIEWS = [
  { value: "weeks", label: "Settimane" },
  { value: "months", label: "Mesi" },
] as const;

/**
 * Un solo grafico dei km: le ultime 12 settimane (con media e obiettivo) o
 * gli ultimi 12 mesi. Parte dai mesi se stai guardando un mese o un anno.
 */
export function RunTrend({ stats, runs, now }: { stats: RunStats; runs: RunEntry[]; now: Date }) {
  const { period } = usePeriodSelection(now, "week");
  const [view, setView] = useState<(typeof TREND_VIEWS)[number]["value"]>(period === "year" || period === "all" ? "months" : "weeks");
  return (
    <Section title="Andamento" hint={view === "weeks" ? "Km a settimana" : "Km al mese · tocca un mese per aprirlo"}>
      <Segmented value={view} options={TREND_VIEWS} onChange={setView} size="sm" className="mb-4" />
      {view === "weeks" ? (
        <WeeklyChart weekly={stats.weekly} goalKm={stats.settings.weeklyRunKmGoal} />
      ) : (
        <MonthlyKm runs={runs} now={now} />
      )}
    </Section>
  );
}
