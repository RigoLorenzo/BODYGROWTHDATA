import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ActiveSession, ActiveExercise, ActiveSet } from "@/types";

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
  /** Spunta la serie come fatta e propone gli stessi valori alla successiva */
  completeSet: (exerciseId: string, setIndex: number) => void;
  /** Toglie la spunta: la serie torna da fare e non viene registrata */
  uncompleteSet: (exerciseId: string, setIndex: number) => void;

  /** Conferma le serie compilate ma non ancora spuntate */
  confirmFilledSets: (exerciseId: string) => void;

  // UI
  setSessionPanelOpen: (open: boolean) => void;
}

type SessionUpdater = (session: ActiveSession) => ActiveSession;

const mapExercise = (
  session: ActiveSession,
  exerciseId: string,
  fn: (ex: ActiveExercise) => ActiveExercise
): ActiveSession => ({
  ...session,
  exercises: session.exercises.map((ex) => (ex.id === exerciseId ? fn(ex) : ex)),
});

const mapSet = (ex: ActiveExercise, setIndex: number, fn: (s: ActiveSet) => ActiveSet): ActiveExercise => ({
  ...ex,
  sets: ex.sets.map((s, i) => (i === setIndex ? fn(s) : s)),
});

/** Serie con dati inseriti dall'utente ma non ancora spuntata */
export const isFilledUnconfirmed = (s: ActiveSet) =>
  !s.completed && !s.prefilled && (s.weight != null || s.reps != null);

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => {
      const update = (fn: SessionUpdater) =>
        set((state) => (state.activeSession ? { activeSession: fn(state.activeSession) } : state));

      return {
        activeSession: null,
        isSessionPanelOpen: false,

        startSession: (session) => set({ activeSession: session, isSessionPanelOpen: true }),

        endSession: () => set({ activeSession: null, isSessionPanelOpen: false }),

        addExercise: (exercise) =>
          update((session) => ({ ...session, exercises: [...session.exercises, exercise] })),

        removeExercise: (exerciseId) =>
          update((session) => ({
            ...session,
            exercises: session.exercises.filter((e) => e.id !== exerciseId),
          })),

        reorderExercises: (exercises) => update((session) => ({ ...session, exercises })),

        addSet: (exerciseId, newSet) =>
          update((session) => mapExercise(session, exerciseId, (ex) => ({ ...ex, sets: [...ex.sets, newSet] }))),

        updateSet: (exerciseId, setIndex, updates) =>
          update((session) => {
            // Se peso o ripetizioni arrivano dall'utente, la serie non è più un suggerimento
            const touched =
              ("weight" in updates || "reps" in updates) && updates.prefilled === undefined
                ? { prefilled: false }
                : {};
            return mapExercise(session, exerciseId, (ex) =>
              mapSet(ex, setIndex, (s) => ({ ...s, ...updates, ...touched }))
            );
          }),

        removeSet: (exerciseId, setIndex) =>
          update((session) =>
            mapExercise(session, exerciseId, (ex) => ({
              ...ex,
              sets: ex.sets
                .filter((_, i) => i !== setIndex)
                .map((s, i) => ({ ...s, setNumber: i + 1 })),
            }))
          ),

        completeSet: (exerciseId, setIndex) =>
          update((session) =>
            mapExercise(session, exerciseId, (ex) => {
              const done = { ...ex.sets[setIndex], completed: true, prefilled: false };
              const next = ex.sets[setIndex + 1];
              // La serie successiva parte con gli stessi peso/ripetizioni, così non si
              // riscrive tutto ogni volta (resta modificabile).
              const prefillNext = next && !next.completed && next.weight == null && next.reps == null;
              return {
                ...ex,
                sets: ex.sets.map((s, i) => {
                  if (i === setIndex) return done;
                  if (i === setIndex + 1 && prefillNext) {
                    return { ...s, weight: done.weight, reps: done.reps, prefilled: true };
                  }
                  return s;
                }),
              };
            })
          ),

        uncompleteSet: (exerciseId, setIndex) =>
          update((session) =>
            mapExercise(session, exerciseId, (ex) =>
              // I valori restano come proposta: a fine allenamento non vengono
              // registrati finché non la spunti di nuovo o li modifichi.
              mapSet(ex, setIndex, (s) => ({ ...s, completed: false, prefilled: true }))
            )
          ),

        /**
         * Conferma le serie che l'utente ha compilato ma non ha spuntato.
         * Le serie solo suggerite (copiate dalla precedente o tolte dalla spunta)
         * restano fuori: i dati non inseriti non vengono mai registrati.
         */
        confirmFilledSets: (exerciseId) =>
          update((session) =>
            mapExercise(session, exerciseId, (ex) => ({
              ...ex,
              sets: ex.sets.map((s) => (isFilledUnconfirmed(s) ? { ...s, completed: true } : s)),
            }))
          ),

        setSessionPanelOpen: (open) => set({ isSessionPanelOpen: open }),
      };
    },
    {
      name: "bodygrowth-session",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeSession: state.activeSession }),
      // Le versioni precedenti cronometravano recuperi e fasi: si tengono solo
      // esercizi e serie, così un allenamento in corso sopravvive all'aggiornamento.
      migrate: (persisted) => {
        const state = persisted as { activeSession?: (ActiveSession & Record<string, unknown>) | null };
        if (state?.activeSession) {
          const { id, startedAt, exercises, programDayId, programDayName } = state.activeSession;
          state.activeSession = { id, startedAt, exercises, programDayId, programDayName };
        }
        return state as never;
      },
    }
  )
);
