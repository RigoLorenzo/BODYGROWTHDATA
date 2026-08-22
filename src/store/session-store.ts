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

  // Ciclo dell'esercizio: inizio → serie → recupero → esercizio successivo
  startExercise: (exerciseId: string) => void;
  finishExercise: (exerciseId: string) => void;
  startRest: (kind: RestInterval["kind"], opts?: { exerciseId?: string; setIndex?: number; targetSeconds?: number }) => void;
  endRest: () => void;

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

/** Esercizio a cui si riferisce la fase corrente (lavoro o recupero) */
export function getCurrentExercise(session: ActiveSession | null): ActiveExercise | null {
  if (!session) return null;
  const openRest = getOpenRest(session);
  const id = openRest?.exerciseId ?? session.currentExerciseId;
  return session.exercises.find((e) => e.id === id) ?? null;
}

/** Prossimo esercizio da iniziare: il primo mai avviato, altrimenti uno non terminato */
export function getNextExercise(session: ActiveSession | null): ActiveExercise | null {
  if (!session) return null;
  return (
    session.exercises.find((e) => !e.startedAt) ??
    session.exercises.find((e) => !e.finishedAt) ??
    null
  );
}

/**
 * Fase corrente della sessione:
 * - REST: recupero in corso (sempre legato a un esercizio)
 * - WORK: stai svolgendo un esercizio
 * - IDLE: nessun esercizio in corso, non si cronometra nulla
 */
export function getPhase(session: ActiveSession | null): "IDLE" | "WORK" | "REST" {
  if (!session) return "IDLE";
  if (getOpenRest(session)) return "REST";
  const current = session.exercises.find((e) => e.id === session.currentExerciseId);
  return current && current.startedAt && !current.finishedAt ? "WORK" : "IDLE";
}

/** Secondi di lavoro effettivo di un esercizio (durata meno i suoi recuperi) */
export function getExerciseWorkSeconds(
  session: ActiveSession | null,
  exerciseId: string,
  now: number = Date.now()
): number {
  const ex = session?.exercises.find((e) => e.id === exerciseId);
  if (!session || !ex?.startedAt) return 0;
  const end = ex.finishedAt ?? now;
  const elapsed = Math.max(0, Math.floor((end - ex.startedAt) / 1000));
  // Solo i recuperi avvenuti dentro l'esercizio (quello finale è escluso)
  const restInside = (session.restIntervals ?? [])
    .filter((r) => r.exerciseId === exerciseId && r.startedAt < end)
    .reduce(
      (sum, r) => sum + Math.max(0, Math.floor((Math.min(r.endedAt ?? now, end) - r.startedAt) / 1000)),
      0
    );
  return Math.max(0, elapsed - restInside);
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
          const now = Date.now();
          const wasCurrent = state.activeSession.currentExerciseId === exerciseId;
          return {
            activeSession: {
              ...state.activeSession,
              exercises: state.activeSession.exercises.filter((e) => e.id !== exerciseId),
              currentExerciseId: wasCurrent ? undefined : state.activeSession.currentExerciseId,
              // I cronometri non restano appesi a un esercizio che non c'è più
              restIntervals: (state.activeSession.restIntervals ?? []).map((r) =>
                r.exerciseId === exerciseId && !r.endedAt ? { ...r, endedAt: now } : r
              ),
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
        // Registrare una serie significa che quell'esercizio è in corso
        const state = get().activeSession;
        const target = state?.exercises.find((e) => e.id === exerciseId);
        if (!target?.startedAt || target.finishedAt || state?.currentExerciseId !== exerciseId) {
          get().startExercise(exerciseId);
        }

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

      /** Chiude il recupero e torna a lavorare sull'esercizio a cui era legato */
      endRest: () =>
        set((state) => {
          if (!state.activeSession) return state;
          const now = Date.now();
          const open = getOpenRest(state.activeSession);
          const backTo = open?.exerciseId;
          return {
            activeSession: {
              ...state.activeSession,
              currentExerciseId: backTo ?? state.activeSession.currentExerciseId,
              restIntervals: closeOpenIntervals(state.activeSession.restIntervals ?? [], now),
              exercises: state.activeSession.exercises.map((ex) =>
                backTo && ex.id === backTo && open?.kind === "SET"
                  ? { ...ex, finishedAt: undefined, finished: false }
                  : ex
              ),
            },
          };
        }),

      /** Inizia (o riprende) un esercizio: chiude il recupero e fa partire il lavoro */
      startExercise: (exerciseId) =>
        set((state) => {
          if (!state.activeSession) return state;
          const now = Date.now();
          return {
            activeSession: {
              ...state.activeSession,
              currentExerciseId: exerciseId,
              restIntervals: closeOpenIntervals(state.activeSession.restIntervals ?? [], now),
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId
                  ? { ...ex, startedAt: ex.startedAt ?? now, finishedAt: undefined, finished: false }
                  : ex
              ),
            },
          };
        }),

      /** Fine esercizio: chiude il lavoro e fa partire il recupero verso il prossimo */
      finishExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return state;
          const now = Date.now();
          return {
            activeSession: {
              ...state.activeSession,
              currentExerciseId: exerciseId,
              exercises: state.activeSession.exercises.map((ex) =>
                ex.id === exerciseId
                  ? { ...ex, startedAt: ex.startedAt ?? now, finishedAt: now, finished: true }
                  : ex
              ),
            },
          };
        });
        const ex = get().activeSession?.exercises.find((e) => e.id === exerciseId);
        get().startRest("EXERCISE", { exerciseId, targetSeconds: ex?.restTimerSeconds ?? 120 });
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
