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
  theme: "dark" | "light";
  units: "kg" | "lbs";
  isExerciseSelectorOpen: boolean;
  selectedExerciseForSession: string | null;
  workoutConflict: WorkoutConflict | null;

  setTheme: (theme: "dark" | "light") => void;
  setUnits: (units: "kg" | "lbs") => void;
  openExerciseSelector: (exerciseId?: string) => void;
  closeExerciseSelector: () => void;
  setWorkoutConflict: (conflict: WorkoutConflict | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  units: "kg",
  isExerciseSelectorOpen: false,
  selectedExerciseForSession: null,
  workoutConflict: null,

  setTheme: (theme) => set({ theme }),
  setUnits: (units) => set({ units }),
  openExerciseSelector: (exerciseId) =>
    set({ isExerciseSelectorOpen: true, selectedExerciseForSession: exerciseId ?? null }),
  closeExerciseSelector: () =>
    set({ isExerciseSelectorOpen: false, selectedExerciseForSession: null }),
  setWorkoutConflict: (workoutConflict) => set({ workoutConflict }),
}));
