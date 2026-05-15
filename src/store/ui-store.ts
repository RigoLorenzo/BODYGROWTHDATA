import { create } from "zustand";

interface UIState {
  theme: "dark" | "light";
  units: "kg" | "lbs";
  isExerciseSelectorOpen: boolean;
  selectedExerciseForSession: string | null;

  setTheme: (theme: "dark" | "light") => void;
  setUnits: (units: "kg" | "lbs") => void;
  openExerciseSelector: (exerciseId?: string) => void;
  closeExerciseSelector: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "dark",
  units: "kg",
  isExerciseSelectorOpen: false,
  selectedExerciseForSession: null,

  setTheme: (theme) => set({ theme }),
  setUnits: (units) => set({ units }),
  openExerciseSelector: (exerciseId) =>
    set({ isExerciseSelectorOpen: true, selectedExerciseForSession: exerciseId ?? null }),
  closeExerciseSelector: () =>
    set({ isExerciseSelectorOpen: false, selectedExerciseForSession: null }),
}));
