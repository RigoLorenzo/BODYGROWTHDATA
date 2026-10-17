import { create } from "zustand";

/** Allenamento già aperto sul server che blocca l'avvio di uno nuovo */
export interface WorkoutConflict {
  sessionId: string;
  startedAt: string;
  exerciseCount: number;
  /** Parametri dell'avvio da ritentare dopo aver scartato il vecchio */
  retry: {
    data: Record<string, unknown>;
    planExercises: unknown[];
  };
}

interface UIState {
  isExerciseSelectorOpen: boolean;
  selectedExerciseForSession: string | null;
  workoutConflict: WorkoutConflict | null;
  /** Apre il form delle Misurazioni Corporee (unica fonte di peso e composizione) */
  measurementFormOpen: boolean;

  openExerciseSelector: (exerciseId?: string) => void;
  closeExerciseSelector: () => void;
  setWorkoutConflict: (conflict: WorkoutConflict | null) => void;
  setMeasurementFormOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isExerciseSelectorOpen: false,
  selectedExerciseForSession: null,
  workoutConflict: null,
  measurementFormOpen: false,

  openExerciseSelector: (exerciseId) =>
    set({ isExerciseSelectorOpen: true, selectedExerciseForSession: exerciseId ?? null }),
  closeExerciseSelector: () =>
    set({ isExerciseSelectorOpen: false, selectedExerciseForSession: null }),
  setWorkoutConflict: (workoutConflict) => set({ workoutConflict }),
  setMeasurementFormOpen: (measurementFormOpen) => set({ measurementFormOpen }),
}));
