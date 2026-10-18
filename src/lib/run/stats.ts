import { addWeeks, startOfWeek } from "date-fns";
import type { BestEffort } from "./track";

/** Dati minimi di una corsa per le statistiche */
export interface RunLike {
  id: string;
  startedAt: Date;
  distance: number;
  movingTime: number;
  elevationGain: number | null;
  bestEfforts: unknown;
}

export interface PeriodTotals {
  runs: number;
  distance: number;
  movingTime: number;
  elevationGain: number;
  /** secondi al km sul totale del periodo */
  avgPace: number | null;
}

export function totals(runs: RunLike[]): PeriodTotals {
  const distance = runs.reduce((s, r) => s + r.distance, 0);
  const movingTime = runs.reduce((s, r) => s + r.movingTime, 0);
  return {
    runs: runs.length,
    distance,
    movingTime,
    elevationGain: Math.round(runs.reduce((s, r) => s + (r.elevationGain ?? 0), 0)),
    avgPace: distance > 0 ? movingTime / (distance / 1000) : null,
  };
}

/** Km e corse per settimana (lunedì-domenica), dalla più vecchia alla più recente */
export function weeklyTotals(runs: RunLike[], weeks: number, now: Date = new Date()) {
  const current = startOfWeek(now, { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, i) => {
    const start = addWeeks(current, i - weeks + 1);
    const end = addWeeks(start, 1);
    const inWeek = runs.filter((r) => r.startedAt >= start && r.startedAt < end);
    return { weekStart: start, ...totals(inWeek) };
  });
}

const isEffort = (e: unknown): e is BestEffort =>
  !!e && typeof e === "object" && typeof (e as BestEffort).seconds === "number" && typeof (e as BestEffort).name === "string";

export interface RunRecord {
  name: string;
  distance: number;
  seconds: number;
  runId: string;
  date: Date;
}

/** Record personali: miglior tempo per distanza standard su tutte le corse */
export function personalRecords(runs: RunLike[]): RunRecord[] {
  const best = new Map<string, RunRecord>();
  for (const run of runs) {
    const efforts = Array.isArray(run.bestEfforts) ? run.bestEfforts.filter(isEffort) : [];
    for (const e of efforts) {
      const current = best.get(e.name);
      if (!current || e.seconds < current.seconds) {
        best.set(e.name, { name: e.name, distance: e.distance, seconds: e.seconds, runId: run.id, date: run.startedAt });
      }
    }
  }
  return Array.from(best.values()).sort((a, b) => a.distance - b.distance);
}

/** Corsa più lunga e ritmo medio migliore (su almeno 3 km) */
export function highlights(runs: RunLike[]) {
  const longest = runs.reduce<RunLike | null>((a, r) => (!a || r.distance > a.distance ? r : a), null);
  const fastest = runs
    .filter((r) => r.distance >= 3000 && r.movingTime > 0)
    .reduce<RunLike | null>((a, r) => (!a || r.movingTime / r.distance < a.movingTime / a.distance ? r : a), null);
  return { longest, fastest };
}
