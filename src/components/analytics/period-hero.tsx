"use client";

import { useMemo } from "react";
import { periodTotals, type ActivityItem, type Totals } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { cn, formatVolume } from "@/lib/utils";
import { KIND_STYLE } from "./activity-kind";
import { CompareLine, DiffBadge, compareContext, type CompareContext } from "./compare";
import { formatHours, splitUnit } from "./format";
import { HeadlineNumber, KpiRow, PeriodCard, firstActivity, type Kpi, type PeriodSelection } from "./period-card";

export type { PeriodSelection } from "./period-card";
export { firstActivity } from "./period-card";

/** Tre numeri di contorno con nomi che non vanno spiegati */
function kpis(current: Totals, previous: Totals | null, ctx: CompareContext | null, hasRuns: boolean): Kpi[] {
  const [lifted, liftedUnit] = splitUnit(formatVolume(current.volume));
  const hide = !previous || !ctx || ctx.early;
  const diff = (now: number, before: number | undefined, write: (n: number) => string) =>
    hide || !before ? undefined : <DiffBadge inverse diff={now - before} format={write} />;
  return [
    { label: "Tempo allenato", value: formatHours(current.duration), detail: diff(current.duration, previous?.duration, formatHours) },
    { label: "Peso sollevato", value: lifted, unit: liftedUnit, detail: diff(current.volume, previous?.volume, formatVolume) },
    hasRuns
      ? { label: "Km corsi", value: formatKm(current.distance), detail: diff(current.distance, previous?.distance, (m) => `${formatKm(m)} km`) }
      : { label: "Giorni attivi", value: current.activeDays, detail: diff(current.activeDays, previous?.activeDays, String) },
  ];
}

/** Di cosa sono fatti gli allenamenti: una barra sola, con i conteggi scritti */
function KindSplit({ totals }: { totals: Totals }) {
  const parts = [
    { kind: "gym" as const, count: totals.gym },
    { kind: "run" as const, count: totals.runs },
    { kind: "cardio" as const, count: totals.other },
  ].filter((p) => p.count > 0);
  if (!parts.length) return null;
  const dot = (kind: (typeof parts)[number]["kind"]) => (kind === "gym" ? "bg-background" : KIND_STYLE[kind].dot);
  return (
    <div className="mt-5">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
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
 * Il periodo scelto in pochi secondi: quante volte ti sei allenato, una frase
 * che dice se è più o meno di prima, di cosa sono fatti gli allenamenti e
 * tre numeri di contorno.
 */
export function PeriodHero({ items, now, selection }: { items: ActivityItem[]; now: Date; selection: PeriodSelection }) {
  const { period, anchor } = selection;
  const { current, previous } = periodTotals(items, period, now, anchor);
  const first = useMemo(() => firstActivity(items), [items]);
  const hasRuns = useMemo(() => items.some((i) => i.kind === "run"), [items]);
  const ctx = compareContext(period, anchor, now);

  return (
    <PeriodCard selection={selection} now={now} first={first} pickerItems={items}>
      <HeadlineNumber
        value={current.sessions}
        caption={current.sessions === 1 ? "allenamento" : "allenamenti"}
        compare={
          previous && (
            <CompareLine
              inverse
              ctx={ctx}
              diff={current.sessions - previous.sessions}
              previous={previous.sessions}
              noun={(n) => (n === 1 ? "allenamento" : "allenamenti")}
            />
          )
        }
      />
      <KindSplit totals={current} />
      <KpiRow items={kpis(current, previous, ctx, hasRuns)} />
    </PeriodCard>
  );
}
