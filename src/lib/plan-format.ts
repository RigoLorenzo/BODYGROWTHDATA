import { getMuscleContributions, PRIMARY_CONTRIBUTION, type ExerciseLike } from "./muscle-volume";

/** "G2 — Gambe A · Deltoidi" → { code: "G2", title: "Gambe A · Deltoidi" } */
export function splitDayName(name: string, index: number) {
  const [head, ...rest] = name.split(" — ");
  if (rest.length && head.length <= 4) return { code: head, title: rest.join(" — ") };
  return { code: `G${index + 1}`, title: name };
}

/** 8-12, oppure 12 se min e max coincidono */
export const repsLabel = (min: number, max: number) => (min === max ? `${min}` : `${min}-${max}`);

/** Serie per muscolo principale, dal più allenato */
export function setsByMuscle(exercises: { sets: number; exercise: { primaryMuscle: string | null } | null }[]) {
  const totals = new Map<string, number>();
  for (const ex of exercises) {
    const muscle = ex.exercise?.primaryMuscle ?? "FULL_BODY";
    totals.set(muscle, (totals.get(muscle) ?? 0) + ex.sets);
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
}

export interface PlannedMuscleVolume {
  /** Serie su esercizi in cui il muscolo è il principale */
  direct: number;
  /** Serie pesate per contributo: principale 1, secondario 0.5, terziario 0.25 */
  weighted: number;
}

/**
 * Volume pianificato per muscolo con lo stesso modello di Analytics, così
 * piano e statistiche parlano la stessa lingua.
 */
export function plannedMuscleVolume(
  exercises: { sets: number; exercise: ExerciseLike | null }[]
): [string, PlannedMuscleVolume][] {
  const totals = new Map<string, PlannedMuscleVolume>();
  for (const ex of exercises) {
    if (!ex.exercise) continue;
    for (const [muscle, coefficient] of Object.entries(getMuscleContributions(ex.exercise))) {
      const current = totals.get(muscle) ?? { direct: 0, weighted: 0 };
      if (coefficient >= PRIMARY_CONTRIBUTION) current.direct += ex.sets;
      current.weighted += ex.sets * coefficient;
      totals.set(muscle, current);
    }
  }
  return Array.from(totals.entries()).sort((a, b) => b[1].weighted - a[1].weighted);
}
