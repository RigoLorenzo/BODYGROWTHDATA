import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ActiveSession, ActiveExercise, ActiveSet, RestInterval } from "@/types";

interface SessionState {
  activeSession: ActiveSession | null;
  isSessionPanelOpen: boolean;

  // Session actions
  startSession: (session: ActiveSession) => void;
  endSession: () => void;

  // Exercise actions
  addExercise: (exercise: ActiveExercise) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (exercises: ActiveExercise[]) => void;

  // Set actions
  addSet: (exerciseId: string, set: ActiveSet) => void;
  updateSet: (exerciseId: string, setIndex: number, updates: Partial<ActiveSet>) => void;
  removeSet: (exerciseId: string, setIndex: number) => void;
  completeSet: (exerciseId: string, setIndex: number) => void;

  // Rest tracking
  startRest: (kind: RestInterval["kind"], opts?: { exerciseId?: string; setIndex?: number; targetSeconds?: number }) => void;
  endRest: () => void;
  finishExercise: (exerciseId: string) => void;
  resumeExercise: (exerciseId?: string) => void;

  // UI
  setSessionPanelOpen: (open: boolean) => void;
}

/** Recupero attualmente in corso (intervallo ancora aperto), se c'è. */
export function getOpenRest(session: ActiveSession | null): RestInterval | null {
  if (!session) return null;
  return (session.restIntervals ?? []).find((r) => !r.endedAt) ?? null;
}

/** Secondi totali di recupero, incluso quello in corso. */
export function getTotalRestSeconds(session: ActiveSession | null, now: number = Date.now()): number {
  if (!session) return 0;
  return (session.restIntervals ?? []).reduce(
    (sum, r) => sum + Math.max(0, Math.floor(((r.endedAt ?? now) - r.startedAt) / 1000)),
    0
  );
}

/** Secondi di lavoro effettivo = durata totale meno i recuperi. */
export function getActiveSeconds(session: ActiveSession | null, now: number = Date.now()): number {
  if (!session) return 0;
  const total = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));
  return Math.max(0, total - getTotalRestSeconds(session, now));
}

/** Recupero (in secondi) registrato dopo una specifica serie. */
export function getRestAfterSet(
  session: ActiveSession | null,
  exerciseId: string,
  setIndex: number
): number | undefined {
  const interval = (session?.restIntervals ?? []).find(
    (r) => r.kind === "SET" && r.exerciseId === exerciseId && r.setIndex === setIndex && r.endedAt
  );
  if (!interval?.endedAt) return undefined;
  return Math.max(0, Math.floor((interval.endedAt - interval.startedAt) / 1000));
}

/** Recupero (in secondi) registrato dopo un esercizio. */
export function getRestAfterExercise(session: ActiveSession | null, exerciseId: string): number | undefined {
  const interval = (session?.restIntervals ?? []).find(
    (r) => r.kind === "EXERCISE" && r.exerciseId === exerciseId && r.endedAt
  );
  if (!interval?.endedAt) return undefined;
  return Math.max(0, Math.floor((interval.endedAt - interval.startedAt) / 1000));
}

const closeOpenIntervals = (intervals: RestInterval[], at: number): RestInterval[] =>
  intervals.map((r) => (r.endedAt ? r : { ...r, endedAt: at }));

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      isSessionPanelOpen: false,

      startSession: (session) =>
        set({
          activeSession: { ...session, restIntervals: session.restIntervals ?? [] },
          isSessionPanelOpen: true,
        }),

      endSession: () => set({ activeSession: null, isSessionPanelOpen: false }),

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

        // La serie successiva parte con gli stessi peso/ripetizioni, così non si
        // riscrive tutto ogni volta (resta modificabile).
        const done = get()
          .activeSession?.exercises.find((e) => e.id === exerciseId)
          ?.sets[setIndex];
        const next = get()
          .activeSession?.exercises.find((e) => e.id === exerciseId)
          ?.sets[setIndex + 1];
        if (done && next && !next.completed && next.weight == null && next.reps == null) {
          get().updateSet(exerciseId, setIndex + 1, { weight: done.weight, reps: done.reps });
        }

        const session = get().activeSession;
        if (!session) return;
        const ex = session.exercises.find((e) => e.id === exerciseId);
        // Il recupero tra le serie parte da solo: si ferma quando riprendi.
        get().startRest("SET", { exerciseId, setIndex, targetSeconds: ex?.restTimerSeconds ?? 90 });
      },

      startRest: (kind, opts = {}) =>
        set((state) => {
          if (!state.activeSession) return state;
          const now = Date.now();
          const interval: RestInterval = {
            id: `rest-${now}-${Math.random().toString(36).slice(2, 7)}`,
            kind,
            startedAt: now,
            exerciseId: opts.exerciseId,
            setIndex: opts.setIndex,
            targetSeconds: opts.targetSeconds,
          };
          return {
            activeSession: {
              ...state.activeSession,
              restIntervals: [...closeOpenIntervals(state.activeSession.restIntervals ?? [], now), interval],
            },
          };
        }),

      endRest: () =>
        set((state) => {
          if (!state.activeSession) return state;
          const now = Date.now();
          return {
            activeSession: {
              ...state.activeSession,
              restIntervals: closeOpenIntervals(state.activeSession.restIntervals ?? [], now),
            },
          };
        }),

      finishExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, finished: true } : ex
              ),
            },
          };
        });
        const session = get().activeSession;
        const ex = session?.exercises.find((e) => e.id === exerciseId);
        get().startRest("EXERCISE", { exerciseId, targetSeconds: ex?.restTimerSeconds ?? 120 });
      },

      resumeExercise: (exerciseId) => {
        get().endRest();
        if (!exerciseId) return;
        set((state) => {
          if (!state.activeSession) return state;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, finished: false } : ex
              ),
            },
          };
        });
      },

      setSessionPanelOpen: (open) => set({ isSessionPanelOpen: open }),
    }),
    {
      name: "bodygrowth-session",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeSession: state.activeSession }),
      migrate: (persisted) => {
        const state = persisted as { activeSession?: ActiveSession | null };
        if (state?.activeSession && !state.activeSession.restIntervals) {
          state.activeSession.restIntervals = [];
        }
        return state as never;
      },
    }
  )
);
