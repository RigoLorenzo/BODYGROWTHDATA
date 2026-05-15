import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ActiveSession, ActiveExercise, ActiveSet } from "@/types";

interface RestTimer {
  exerciseId: string;
  setNumber: number;
  seconds: number;
  remaining: number;
  active: boolean;
}

interface SessionState {
  activeSession: ActiveSession | null;
  restTimer: RestTimer | null;
  isSessionPanelOpen: boolean;

  // Session actions
  startSession: (session: ActiveSession) => void;
  endSession: () => void;
  pauseSession: () => void;

  // Exercise actions
  addExercise: (exercise: ActiveExercise) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (exercises: ActiveExercise[]) => void;

  // Set actions
  addSet: (exerciseId: string, set: ActiveSet) => void;
  updateSet: (exerciseId: string, setIndex: number, updates: Partial<ActiveSet>) => void;
  removeSet: (exerciseId: string, setIndex: number) => void;
  completeSet: (exerciseId: string, setIndex: number) => void;

  // Timer actions
  startRestTimer: (exerciseId: string, setNumber: number, seconds: number) => void;
  stopRestTimer: () => void;
  tickRestTimer: () => void;

  // UI
  setSessionPanelOpen: (open: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      restTimer: null,
      isSessionPanelOpen: false,

      startSession: (session) => set({ activeSession: session, isSessionPanelOpen: true }),

      endSession: () => set({ activeSession: null, restTimer: null, isSessionPanelOpen: false }),

      pauseSession: () => {
        const { activeSession } = get();
        if (!activeSession) return;
      },

      addExercise: (exercise) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: [...state.activeSession.exercises, exercise],
            },
          };
        }),

      removeExercise: (exerciseId) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.filter((e) => e.id !== exerciseId),
            },
          };
        }),

      reorderExercises: (exercises) =>
        set((state) => {
          if (!state.activeSession) return state;
          return { activeSession: { ...state.activeSession, exercises } };
        }),

      addSet: (exerciseId, newSet) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, sets: [...ex.sets, newSet] } : ex
              ),
            },
          };
        }),

      updateSet: (exerciseId, setIndex, updates) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId
                  ? {
                      ...ex,
                      sets: ex.sets.map((s, i) => (i === setIndex ? { ...s, ...updates } : s)),
                    }
                  : ex
              ),
            },
          };
        }),

      removeSet: (exerciseId, setIndex) =>
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId
                  ? { ...ex, sets: ex.sets.filter((_, i) => i !== setIndex) }
                  : ex
              ),
            },
          };
        }),

      completeSet: (exerciseId, setIndex) => {
        get().updateSet(exerciseId, setIndex, { completed: true });
        const session = get().activeSession;
        if (!session) return;
        const ex = session.exercises.find((e) => e.id === exerciseId);
        if (ex) {
          get().startRestTimer(exerciseId, setIndex, ex.restTimerSeconds);
        }
      },

      startRestTimer: (exerciseId, setNumber, seconds) =>
        set({ restTimer: { exerciseId, setNumber, seconds, remaining: seconds, active: true } }),

      stopRestTimer: () => set({ restTimer: null }),

      tickRestTimer: () =>
        set((state) => {
          if (!state.restTimer || !state.restTimer.active) return state;
          const remaining = state.restTimer.remaining - 1;
          if (remaining <= 0) return { restTimer: { ...state.restTimer, remaining: 0, active: false } };
          return { restTimer: { ...state.restTimer, remaining } };
        }),

      setSessionPanelOpen: (open) => set({ isSessionPanelOpen: open }),
    }),
    {
      name: "bodygrowth-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeSession: state.activeSession }),
    }
  )
);
