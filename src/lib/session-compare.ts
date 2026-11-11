import { formatNumberIt, type WorkoutShareStats } from "./workout-share";

/** I numeri di una seduta che si confrontano con l'ultima volta dello stesso giorno del piano */
export interface SessionTotals {
  startedAt: string;
  tonnage: number;
  workingSets: number;
  reps: number;
}

export interface SessionDiff {
  key: "tonnage" | "workingSets" | "reps";
  label: string;
  diff: number;
  /** "+320 kg", "−2 serie", "uguale" */
  text: string;
}

export const sessionTotals = (startedAt: Date | string, stats: WorkoutShareStats): SessionTotals => ({
  startedAt: new Date(startedAt).toISOString(),
  tonnage: stats.tonnage,
  workingSets: stats.workingSets,
  reps: stats.reps,
});

const signed = (n: number, unit: string) => (n === 0 ? "uguale" : `${n > 0 ? "+" : "−"}${formatNumberIt(Math.abs(n), 1)}${unit}`);

/** Differenze con la seduta precedente: volume, serie e ripetizioni */
export function compareSessions(current: SessionTotals, previous: SessionTotals): SessionDiff[] {
  const tonnage = Math.round((current.tonnage - previous.tonnage) * 10) / 10;
  const sets = current.workingSets - previous.workingSets;
  const reps = current.reps - previous.reps;
  return [
    { key: "tonnage", label: "Volume", diff: tonnage, text: signed(tonnage, " kg") },
    { key: "workingSets", label: "Serie", diff: sets, text: signed(sets, "") },
    { key: "reps", label: "Ripetizioni", diff: reps, text: signed(reps, "") },
  ];
}
