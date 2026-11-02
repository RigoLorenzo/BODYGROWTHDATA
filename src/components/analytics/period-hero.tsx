"use client";

import { useMemo } from "react";
import { periodTotals, type ActivityItem, type Totals } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { cn, formatVolume } from "@/lib/utils";
import { KIND_STYLE } from "./activity-kind";
import { Delta } from "./delta";
import { formatDelta, formatHours, splitUnit } from "./format";
import { HeadlineNumber, KpiRow, PeriodCard, firstActivity, previousLabel, type Kpi, type PeriodSelection } from "./period-card";

export type { PeriodSelection } from "./period-card";
export { firstActivity } from "./period-card";

/** Tre numeri di contorno: tempo, carico in palestra e km di corsa (se corri) */
function kpis(current: Totals, previous: Totals | null, hasRuns: boolean): Kpi[] {
  const [volume, volumeUnit] = splitUnit(formatVolume(current.volume));
  const delta = (now: number, before?: number) => <Delta inverse value={formatDelta(now, before)} />;
  return [
    { label: "Tempo", value: formatHours(current.duration), detail: delta(current.duration, previous?.duration) },
    { label: "Volume", value: volume, unit: volumeUnit, detail: delta(current.volume, previous?.volume) },
    hasRuns
      ? { label: "Corsa", value: formatKm(current.distance), unit: "km", detail: delta(current.distance, previous?.distance) }
      : { label: "Giorni attivi", value: current.activeDays, detail: delta(current.activeDays, previous?.activeDays) },
  ];
}

/** Proporzione palestra / corsa / altro in una sola barra, con i conteggi */
function KindSplit({ totals }: { totals: Totals }) {
  const parts = [
    { kind: "gym" as const, count: totals.gym },
    { kind: "run" as const, count: totals.runs },
    { kind: "cardio" as const, count: totals.other },
  ].filter((p) => p.count > 0);
  if (!parts.length) return null;
  const dot = (kind: (typeof parts)[number]["kind"]) => (kind === "gym" ? "bg-background" : KIND_STYLE[kind].dot);
  return (
    <div className="mt-4">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) => (
          <span key={p.kind} className={cn("h-full", dot(p.kind))} style={{ flexGrow: p.count }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <span key={p.kind} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", dot(p.kind))} aria-hidden />
            <span className="opacity-70">{KIND_STYLE[p.kind].label}</span>
            <span className="font-semibold tabular-nums">{p.count}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * Il periodo scelto a colpo d'occhio: un numero principale (allenamenti) col
 * confronto, la ripartizione per tipo e tre valori di contorno.
 */
export function PeriodHero({ items, now, selection }: { items: ActivityItem[]; now: Date; selection: PeriodSelection }) {
  const { period, anchor } = selection;
  const { current, previous } = periodTotals(items, period, now, anchor);
  const first = useMemo(() => firstActivity(items), [items]);
  const hasRuns = useMemo(() => items.some((i) => i.kind === "run"), [items]);
  const compare = period === "all" ? null : previous;

  return (
    <PeriodCard selection={selection} now={now} first={first} pickerItems={items}>
      <HeadlineNumber
        value={current.sessions}
        caption={current.sessions === 1 ? "allenamento" : "allenamenti"}
        delta={compare && <Delta inverse value={formatDelta(current.sessions, compare.sessions)} />}
        compareLabel={compare && `vs ${previousLabel(period, anchor, now)} (${compare.sessions})`}
      />
      <KindSplit totals={current} />
      <KpiRow items={kpis(current, compare, hasRuns)} />
    </PeriodCard>
  );
}
