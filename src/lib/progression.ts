/**
 * Doppia progressione: si parte dai numeri dell'ultima volta e, quando tutte
 * le serie al peso più alto hanno raggiunto il massimo delle ripetizioni del
 * piano, si propone di salire di peso ripartendo dal minimo.
 */

export interface LoggedSet {
  weight: number | null;
  reps: number | null;
}

export interface RepTarget {
  repsMin?: number;
  repsMax?: number;
}

export interface ProgressionSuggestion {
  /** Valori proposti per ogni serie di oggi */
  sets: { weight: number; reps: number }[];
  /** true quando si propone un aumento di carico */
  increase: boolean;
  /** Peso di partenza dell'ultima volta (il più alto) */
  previousTop: number;
}

const isLogged = (s: LoggedSet): s is { weight: number; reps: number } =>
  typeof s.weight === "number" && s.weight > 0 && typeof s.reps === "number" && s.reps > 0;

/** Incremento sensato: piccoli pesi (manubri leggeri, isolamento) salgono meno */
export const weightIncrement = (weight: number): number => (weight < 20 ? 1 : 2.5);

const round = (n: number) => Math.round(n * 100) / 100;

export function suggestProgression(
  last: LoggedSet[],
  target: RepTarget,
  setCount: number
): ProgressionSuggestion | null {
  const logged = last.filter(isLogged);
  if (!logged.length || setCount < 1) return null;

  const previousTop = Math.max(...logged.map((s) => s.weight));
  const topSets = logged.filter((s) => s.weight === previousTop);
  const reachedTop = !!target.repsMax && topSets.every((s) => s.reps >= target.repsMax!);

  if (reachedTop) {
    const weight = round(previousTop + weightIncrement(previousTop));
    const reps = target.repsMin ?? target.repsMax!;
    return { sets: Array.from({ length: setCount }, () => ({ weight, reps })), increase: true, previousTop };
  }

  // Stessi numeri serie per serie: l'obiettivo è batterli di una ripetizione
  const sets = Array.from({ length: setCount }, (_, i) => {
    const ref = logged[Math.min(i, logged.length - 1)];
    return { weight: ref.weight, reps: ref.reps };
  });
  return { sets, increase: false, previousTop };
}

/** "80×6 · 80×6 · 77,5×8" */
export const formatLoggedSets = (sets: LoggedSet[]): string =>
  sets
    .filter(isLogged)
    .map((s) => `${String(s.weight).replace(".", ",")}×${s.reps}`)
    .join(" · ");
