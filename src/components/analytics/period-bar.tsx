"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { periodLabel, periodStart, periodWindow, shiftPeriod, type ActivityItem, type Period } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { PERIOD_OPTIONS, PeriodPickerDialog } from "./period-picker";
import { Segmented } from "./ui";

export interface PeriodSelection {
  period: Period;
  anchor: Date;
  setPeriod: (p: Period) => void;
  setAnchor: (d: Date) => void;
  select: (p: Period, d: Date) => void;
}

export const firstActivity = (items: { startedAt: Date }[]) =>
  items.reduce<Date | null>((min, i) => (!min || i.startedAt < min ? i.startedAt : min), null);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Si può andare indietro finché c'è qualcosa da vedere, avanti fino a oggi */
function limits(period: Period, anchor: Date, now: Date, first: Date | null) {
  if (period === "all") return { back: false, forward: false, isCurrent: true };
  const span = periodWindow(period, anchor, now);
  return { back: !!first && span.from! > periodStart(period, first), forward: !span.isCurrent, isCurrent: span.isCurrent };
}

/**
 * Il filtro di tutta la pagina, sempre in vista mentre scorri: tipo di
 * periodo e quale periodo. Toccando il nome si sceglie il mese (o l'anno).
 */
export function PeriodBar({
  selection,
  now,
  first,
  pickerItems,
}: {
  selection: PeriodSelection;
  now: Date;
  first: Date | null;
  /** colorano i mesi nel selettore */
  pickerItems: ActivityItem[];
}) {
  const { period, anchor, setPeriod, setAnchor } = selection;
  const [pickerOpen, setPickerOpen] = useState(false);
  const { back, forward, isCurrent } = limits(period, anchor, now, first);
  const pickable = period === "month" || period === "year";
  const arrow =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 active:bg-muted disabled:opacity-20";

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/95 px-4 pb-1.5 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Segmented value={period} options={PERIOD_OPTIONS} onChange={setPeriod} size="sm" />
      <div className="mt-1 flex items-center">
        <button
          type="button"
          onClick={() => setAnchor(shiftPeriod(period as Exclude<Period, "all">, anchor, -1))}
          disabled={!back}
          aria-label="Periodo precedente"
          className={cn(arrow, period === "all" && "invisible")}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <button
            type="button"
            onClick={pickable ? () => setPickerOpen(true) : undefined}
            disabled={!pickable}
            aria-haspopup={pickable ? "dialog" : undefined}
            className="flex h-10 min-w-0 items-center gap-1 rounded-full px-3 font-display text-lg font-bold uppercase tracking-wide active:bg-muted disabled:active:bg-transparent"
          >
            <span className="truncate">{capitalize(periodLabel(period, anchor))}</span>
            {pickable && <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />}
          </button>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => setAnchor(now)}
              className="h-7 shrink-0 rounded-full bg-foreground px-2.5 text-[11px] font-bold uppercase tracking-wide text-background active:scale-95"
            >
              Oggi
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAnchor(shiftPeriod(period as Exclude<Period, "all">, anchor, 1))}
          disabled={!forward}
          aria-label="Periodo successivo"
          className={cn(arrow, period === "all" && "invisible")}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {pickable && (
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
    </div>
  );
}

/** Oltre questo spostamento orizzontale (px) lo scorrimento cambia periodo */
const SWIPE_PX = 60;

/**
 * Il contenuto che cambia col periodo: entra con una breve animazione e si
 * scorre a destra/sinistra per passare al periodo prima o dopo.
 */
export function PeriodSwipe({
  selection,
  now,
  first,
  children,
}: {
  selection: PeriodSelection;
  now: Date;
  first: Date | null;
  children: React.ReactNode;
}) {
  const { period, anchor, setAnchor } = selection;
  const reduce = useReducedMotion();
  const { back, forward } = limits(period, anchor, now, first);
  const span = periodWindow(period, anchor, now);

  const step = (direction: number) => {
    if (period === "all" || (direction < 0 && !back) || (direction > 0 && !forward)) return;
    setAnchor(shiftPeriod(period, anchor, direction));
  };

  return (
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
  );
}
