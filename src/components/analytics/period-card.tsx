"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { periodStart, periodWindow, shiftPeriod, type ActivityItem, type Period } from "@/lib/insights";
import { BackToToday, PERIOD_OPTIONS, PeriodNavigator, PeriodPickerDialog } from "./period-picker";
import { Segmented } from "./ui";

/** Oltre questo spostamento orizzontale (px) lo scorrimento cambia periodo */
const SWIPE_PX = 60;

export interface PeriodSelection {
  period: Period;
  anchor: Date;
  setPeriod: (p: Period) => void;
  setAnchor: (d: Date) => void;
  select: (p: Period, d: Date) => void;
}

export const firstActivity = (items: { startedAt: Date }[]) =>
  items.reduce<Date | null>((min, i) => (!min || i.startedAt < min ? i.startedAt : min), null);

/**
 * La card scura del periodo, uguale in Riepilogo, Palestra e Corsa: scelta
 * del periodo, frecce, scorrimento e scelta del mese. Il contenuto cambia
 * con un'animazione a ogni periodo.
 */
export function PeriodCard({
  selection,
  now,
  first,
  pickerItems,
  children,
}: {
  selection: PeriodSelection;
  now: Date;
  /** prima attività: prima non c'è nulla da vedere */
  first: Date | null;
  /** colorano i mesi nel selettore */
  pickerItems: ActivityItem[];
  children: React.ReactNode;
}) {
  const { period, anchor, setPeriod, setAnchor } = selection;
  const [pickerOpen, setPickerOpen] = useState(false);
  const reduce = useReducedMotion();
  const span = periodWindow(period, anchor, now);
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
      <PeriodNavigator period={period} anchor={anchor} now={now} first={first} onChange={setAnchor} onOpenPicker={() => setPickerOpen(true)} />

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
          {children}
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
          items={pickerItems}
          onSelect={setAnchor}
        />
      )}
    </section>
  );
}

/** Il numero principale, cosa misura e (sotto) la frase del confronto */
export function HeadlineNumber({
  value,
  unit,
  caption,
  compare,
}: {
  value: React.ReactNode;
  unit?: React.ReactNode;
  caption: React.ReactNode;
  compare?: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="whitespace-nowrap font-display text-7xl font-bold leading-none tabular-nums">
        {value}
        {unit && <span className="ml-1 text-xl font-semibold opacity-60">{unit}</span>}
      </p>
      <p className="mt-1 text-sm opacity-70">{caption}</p>
      {compare}
    </div>
  );
}

export interface Kpi {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** variazione o dettaglio sotto il valore */
  detail?: React.ReactNode;
}

/** Tre numeri di contorno sotto una linea sottile */
export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-background/15 pt-4">
      {items.map((k) => (
        <div key={k.label} className="min-w-0">
          {/* Etichette su una o due righe: i valori restano allineati */}
          <dt className="flex min-h-[2.5em] items-end text-[11px] uppercase leading-tight tracking-wider opacity-60">{k.label}</dt>
          <dd className="truncate font-display text-2xl font-bold leading-tight tabular-nums">
            {k.value}
            {k.unit && <span className="ml-0.5 text-xs font-medium opacity-60">{k.unit}</span>}
          </dd>
          {k.detail && <dd className="text-[11px]">{k.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
