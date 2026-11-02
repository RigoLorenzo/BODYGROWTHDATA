"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { periodStart, periodTotals, shiftPeriod, type ActivityItem, type Period, type Totals } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { cn, formatVolume } from "@/lib/utils";
import { formatDelta, formatHours } from "./format";
import { KIND_STYLE } from "./activity-kind";
import { BackToToday, PERIOD_OPTIONS, PeriodNavigator, PeriodPickerDialog } from "./period-picker";
import { Segmented } from "./ui";

const PREVIOUS_LABEL: Record<Exclude<Period, "all">, [current: string, past: string]> = {
  week: ["settimana scorsa", "settimana prima"],
  month: ["mese scorso", "mese prima"],
  year: ["anno scorso", "anno prima"],
};

/** Oltre questo spostamento orizzontale (px) lo scorrimento cambia periodo */
const SWIPE_PX = 60;

export interface PeriodSelection {
  period: Period;
  anchor: Date;
  setPeriod: (p: Period) => void;
  setAnchor: (d: Date) => void;
  select: (p: Period, d: Date) => void;
}

export const firstActivity = (items: ActivityItem[]) =>
  items.reduce<Date | null>((min, i) => (!min || i.startedAt < min ? i.startedAt : min), null);

const deltaTone = (delta: string | null) =>
  !delta || delta === "=" ? "opacity-60" : delta.startsWith("−") ? "text-red-300 dark:text-red-600" : "text-lime-400 dark:text-lime-600";

interface Kpi {
  label: string;
  value: string;
  unit?: string;
  delta: string | null;
}

/** Tre numeri di contorno: tempo, carico in palestra e km di corsa (se corri) */
function kpis(current: Totals, previous: Totals | null, hasRuns: boolean): Kpi[] {
  const [volume, volumeUnit] = splitUnit(formatVolume(current.volume));
  const list: Kpi[] = [
    { label: "Tempo", value: formatHours(current.duration), delta: formatDelta(current.duration, previous?.duration) },
    { label: "Volume", value: volume, unit: volumeUnit, delta: formatDelta(current.volume, previous?.volume) },
  ];
  list.push(
    hasRuns
      ? { label: "Corsa", value: formatKm(current.distance), unit: "km", delta: formatDelta(current.distance, previous?.distance) }
      : { label: "Giorni attivi", value: String(current.activeDays), delta: formatDelta(current.activeDays, previous?.activeDays) }
  );
  return list;
}

/** "80,4t" → ["80,4", "t"]: l'unità più piccola del numero */
function splitUnit(text: string): [string, string | undefined] {
  const match = text.match(/^([\d.,]+)\s*([a-zA-Z]+)$/);
  return match ? [match[1], match[2]] : [text, undefined];
}

/** Proporzione palestra / corsa / altro in una sola barra, con i conteggi */
function KindSplit({ totals }: { totals: Totals }) {
  const parts = [
    { kind: "gym" as const, count: totals.gym },
    { kind: "run" as const, count: totals.runs },
    { kind: "cardio" as const, count: totals.other },
  ].filter((p) => p.count > 0);
  if (!parts.length) return null;
  return (
    <div className="mt-4">
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) => (
          <span key={p.kind} className={cn("h-full", p.kind === "gym" ? "bg-background" : KIND_STYLE[p.kind].dot)} style={{ flexGrow: p.count }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <span key={p.kind} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", p.kind === "gym" ? "bg-background" : KIND_STYLE[p.kind].dot)} aria-hidden />
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
 * confronto, la ripartizione per tipo e tre valori di contorno. Frecce,
 * scorrimento o scelta del mese per guardare il passato.
 */
export function PeriodHero({ items, now, selection }: { items: ActivityItem[]; now: Date; selection: PeriodSelection }) {
  const { period, anchor, setPeriod, setAnchor } = selection;
  const [pickerOpen, setPickerOpen] = useState(false);
  const reduce = useReducedMotion();
  const { current, previous, window: span } = periodTotals(items, period, now, anchor);
  const delta = formatDelta(current.sessions, previous?.sessions);
  const first = useMemo(() => firstActivity(items), [items]);
  const hasRuns = useMemo(() => items.some((i) => i.kind === "run"), [items]);
  const canGoBack = period !== "all" && !!first && span.from! > periodStart(period, first);

  const step = (direction: number) => {
    if (period === "all") return;
    if (direction < 0 && !canGoBack) return;
    if (direction > 0 && span.isCurrent) return;
    setAnchor(shiftPeriod(period, anchor, direction));
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-foreground p-5 text-background">
      <Segmented
        value={period}
        options={PERIOD_OPTIONS}
        onChange={setPeriod}
        size="sm"
        className="bg-background/15 [&_[aria-selected=false]]:text-background/70 [&_[aria-selected=true]]:bg-background [&_[aria-selected=true]]:text-foreground"
      />
      <PeriodNavigator
        period={period}
        anchor={anchor}
        now={now}
        first={first}
        onChange={setAnchor}
        onOpenPicker={() => setPickerOpen(true)}
      />

      {/* Scorri a sinistra/destra sui numeri per cambiare periodo */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${period}-${span.from?.toISOString() ?? "all"}`}
          initial={reduce ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
          drag={period === "all" ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          dragDirectionLock
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_PX) step(1);
            else if (info.offset.x > SWIPE_PX) step(-1);
          }}
          className="touch-pan-y"
        >
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-7xl font-bold leading-none tabular-nums">{current.sessions}</p>
              <p className="mt-1 text-sm opacity-70">{current.sessions === 1 ? "allenamento" : "allenamenti"}</p>
            </div>
            {delta && previous && period !== "all" && (
              <div className="pb-1 text-right">
                <p className={cn("font-display text-2xl font-bold", deltaTone(delta))}>{delta === "=" ? "Pari" : delta}</p>
                <p className="text-xs opacity-60">
                  vs {PREVIOUS_LABEL[period][span.isCurrent ? 0 : 1]} ({previous.sessions})
                </p>
              </div>
            )}
          </div>

          <KindSplit totals={current} />

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-background/15 pt-4">
            {kpis(current, period === "all" ? null : previous, hasRuns).map((k) => (
              <div key={k.label} className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wider opacity-60">{k.label}</dt>
                <dd className="truncate font-display text-2xl font-bold leading-tight tabular-nums">
                  {k.value}
                  {k.unit && <span className="ml-0.5 text-xs font-medium opacity-60">{k.unit}</span>}
                </dd>
                {k.delta && <dd className={cn("text-[11px] font-semibold tabular-nums", deltaTone(k.delta))}>{k.delta}</dd>}
              </div>
            ))}
          </dl>
        </motion.div>
      </AnimatePresence>

      {!span.isCurrent && <BackToToday onClick={() => setAnchor(now)} />}

      {(period === "month" || period === "year") && (
        <PeriodPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          period={period}
          anchor={anchor}
          now={now}
          first={first}
          items={items}
          onSelect={setAnchor}
        />
      )}
    </section>
  );
}
