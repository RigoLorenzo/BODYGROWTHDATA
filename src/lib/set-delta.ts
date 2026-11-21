/**
 * Confronto di una serie con la stessa serie dell'ultima volta.
 * Con peso e ripetizioni conta il volume (peso × ripetizioni): meno peso ma
 * più ripetizioni non è per forza un passo indietro. Senza peso (corpo
 * libero) contano le ripetizioni; senza ripetizioni, il peso.
 */

export type SetDeltaKind = "volume" | "reps" | "weight";

export interface SetDelta {
  kind: SetDeltaKind;
  diff: number;
}

interface SetValues {
  weight?: number | null;
  reps?: number | null;
}

const positive = (n: number | null | undefined): n is number => typeof n === "number" && n > 0;
const round = (n: number) => Math.round(n * 100) / 100;

export function setDelta(previous: SetValues, current: SetValues): SetDelta | null {
  const weighted = positive(previous.weight) && positive(current.weight);
  const withReps = positive(previous.reps) && positive(current.reps);
  if (weighted && withReps) {
    return { kind: "volume", diff: round(current.weight! * current.reps! - previous.weight! * previous.reps!) };
  }
  if (withReps && !positive(previous.weight) && !positive(current.weight)) {
    return { kind: "reps", diff: current.reps! - previous.reps! };
  }
  if (weighted) return { kind: "weight", diff: round(current.weight! - previous.weight!) };
  return null;
}
