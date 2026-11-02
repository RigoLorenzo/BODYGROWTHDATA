import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { itemsInPeriod, periodWindow, type Period, type PeriodWindow } from "@/lib/insights";

/**
 * Statistiche della corsa per un periodo qualsiasi (settimana, mese, anno,
 * sempre) e confronto col periodo precedente. Funzioni pure, nel browser.
 */

export interface RunEntry {
  id: string;
  startedAt: Date;
  /** metri */
  distance: number;
  /** secondi in movimento */
  movingTime: number;
  elevationGain: number | null;
}

export interface RunTotals {
  runs: number;
  distance: number;
  movingTime: number;
  elevationGain: number;
  /** secondi al km sul totale */
  avgPace: number | null;
  /** corsa più lunga (metri) */
  longest: number;
}

export function runTotals(runs: RunEntry[]): RunTotals {
  const distance = runs.reduce((s, r) => s + r.distance, 0);
  const movingTime = runs.reduce((s, r) => s + r.movingTime, 0);
  return {
    runs: runs.length,
    distance,
    movingTime,
    elevationGain: Math.round(runs.reduce((s, r) => s + (r.elevationGain ?? 0), 0)),
    avgPace: distance > 0 ? movingTime / (distance / 1000) : null,
    longest: runs.reduce((m, r) => Math.max(m, r.distance), 0),
  };
}

export interface RunPeriod {
  current: RunTotals;
  previous: RunTotals | null;
  window: PeriodWindow;
  /** km in più o in meno del periodo prima, in percentuale */
  distanceChange: number | null;
  /** secondi al km: negativo = più veloce del periodo prima */
  paceChange: number | null;
}

/** Il periodo che contiene `anchor` e il confronto con quello prima (come in Analytics) */
export function runPeriod(runs: RunEntry[], period: Period, anchor: Date, now: Date): RunPeriod {
  const window = periodWindow(period, anchor, now);
  const pick = (from: Date | null, to: Date | null) => runTotals(itemsInPeriod(runs, { from, to }));
  const current = pick(window.from, window.to);
  const previous = window.prevFrom && window.prevTo ? pick(window.prevFrom, window.prevTo) : null;
  return {
    current,
    previous,
    window,
    distanceChange: previous && previous.distance > 0 ? Math.round(((current.distance - previous.distance) / previous.distance) * 100) : null,
    paceChange: previous?.avgPace != null && current.avgPace != null ? Math.round(current.avgPace - previous.avgPace) : null,
  };
}

export interface MonthTotals extends RunTotals {
  start: Date;
  /** chiave yyyy-MM */
  key: string;
}

/** Ultimi `count` mesi, dal più vecchio */
export function monthlyRunTotals(runs: RunEntry[], count: number, now: Date): MonthTotals[] {
  const current = startOfMonth(now);
  return Array.from({ length: count }, (_, i) => {
    const start = subMonths(current, count - 1 - i);
    return { start, key: format(start, "yyyy-MM"), ...runTotals(itemsInPeriod(runs, { from: start, to: addMonths(start, 1) })) };
  });
}
