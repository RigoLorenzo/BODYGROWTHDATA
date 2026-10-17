import { suggestProgression, type LoggedSet } from "./progression";
import type { ActiveExercise, ActiveSet } from "@/types";

export type ExerciseHistory = Record<string, { date: string; sets: LoggedSet[] }>;

export interface ExerciseSeed {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseNameIt?: string | null;
  orderIndex: number;
  restSeconds?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  notes?: string;
  fromPlan?: boolean;
}

/** Ultima esecuzione degli esercizi; in caso di errore si parte senza storico */
export async function fetchExerciseHistory(ids: string[]): Promise<ExerciseHistory> {
  if (!ids.length) return {};
  try {
    const res = await fetch(`/api/exercises/history?ids=${encodeURIComponent(ids.join(","))}`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

/**
 * Esercizio pronto per l'allenamento: le serie sono già compilate con la
 * proposta (numeri dell'ultima volta o aumento di carico), in grigio finché
 * non le confermi.
 */
export function buildActiveExercise(seed: ExerciseSeed, history?: ExerciseHistory[string]): ActiveExercise {
  const last = history?.sets ?? [];
  const count = Math.max(1, seed.sets ?? last.length ?? 1);
  const suggestion = suggestProgression(last, { repsMin: seed.repsMin, repsMax: seed.repsMax }, count);

  const sets: ActiveSet[] = Array.from({ length: count }, (_, i) => {
    const proposal = suggestion?.sets[i];
    return {
      setNumber: i + 1,
      type: "WORKING",
      completed: false,
      ...(proposal ? { weight: proposal.weight, reps: proposal.reps, prefilled: true } : {}),
    };
  });

  return {
    id: seed.id,
    exerciseId: seed.exerciseId,
    exerciseName: seed.exerciseName,
    exerciseNameIt: seed.exerciseNameIt ?? null,
    orderIndex: seed.orderIndex,
    restTimerSeconds: seed.restSeconds ?? 90,
    fromPlan: seed.fromPlan,
    targetSets: seed.sets,
    targetRepsMin: seed.repsMin,
    targetRepsMax: seed.repsMax,
    notes: seed.notes,
    lastSets: last.length ? last : undefined,
    progression: suggestion ? { increase: suggestion.increase, previousTop: suggestion.previousTop } : undefined,
    sets,
  };
}
