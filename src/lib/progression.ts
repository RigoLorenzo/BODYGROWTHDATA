/** Serie registrate l'ultima volta che hai fatto un esercizio */
export interface LoggedSet {
  weight: number | null;
  reps: number | null;
}

const isLogged = (s: LoggedSet): s is { weight: number; reps: number } =>
  typeof s.weight === "number" && s.weight > 0 && typeof s.reps === "number" && s.reps > 0;

/** "80×6 · 80×6 · 77,5×8" */
export const formatLoggedSets = (sets: LoggedSet[]): string =>
  sets
    .filter(isLogged)
    .map((s) => `${String(s.weight).replace(".", ",")}×${s.reps}`)
    .join(" · ");
