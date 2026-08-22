"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useSessionStore, getPhase, getOpenRest } from "@/store/session-store";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useSessionTimers } from "@/hooks/use-rest-timer";
import { Button } from "@/components/ui/button";
import { ExerciseCard } from "./exercise-card";
import { ExerciseSelector } from "./exercise-selector";
import { WorkoutPhaseBar } from "./workout-phase-bar";
import { formatVolume, formatClock, cn } from "@/lib/utils";
import { calculateSessionVolume } from "@/lib/volume-calculator";
import { Plus, CheckCircle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ActiveSession, ActiveExercise } from "@/types";
import type { Prisma } from "@prisma/client";

type CompletedWorkout = Prisma.WorkoutSessionGetPayload<{
  include: {
    personalRecords: { include: { exercise: true } };
    exercises: { include: { exercise: true; sets: true } };
  };
}>;

interface Props {
  session: ActiveSession;
  /** Chiamata quando l'allenamento è stato salvato: la pagina mostra il riepilogo */
  onCompleted: (workout: CompletedWorkout) => void;
}

export function ActiveWorkoutView({ session, onCompleted }: Props) {
  const router = useRouter();
  const { addExercise, endSession, startExercise } = useSessionStore();
  const { completeWorkout, isCompleting } = useWorkoutSession();
  const { isResting, totalSeconds, restSeconds, activeSeconds } = useSessionTimers();
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  const abandonMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to abandon");
    },
    onSuccess: () => {
      endSession();
      router.replace("/dashboard");
      toast({ title: "Allenamento abbandonato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile abbandonare l'allenamento", variant: "destructive" });
    },
  });

  const totalVolume = calculateSessionVolume(
    session.exercises.map((ex) => ({ sets: ex.sets.filter((s) => s.completed) }))
  );

  const handleAddExercise = useCallback(
    (exercise: { id: string; name: string; nameIt?: string | null }) => {
      const newExercise: ActiveExercise = {
        id: `ex-${Date.now()}`,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseNameIt: exercise.nameIt ?? null,
        orderIndex: session.exercises.length,
        restTimerSeconds: 90,
        sets: [
          { setNumber: 1, type: "WORKING", completed: false },
        ],
      };
      addExercise(newExercise);

      // Il nuovo esercizio parte subito se non stavi facendo nulla oppure se il
      // recupero in corso è quello che segue un esercizio già concluso: così
      // dopo l'ultima serie si passa direttamente al prossimo esercizio.
      const state = useSessionStore.getState().activeSession;
      const openRest = getOpenRest(state);
      const restExercise = state?.exercises.find((ex) => ex.id === openRest?.exerciseId);
      const restIsBetweenExercises = !!openRest && !restExercise?.sets.some((set) => !set.completed);
      if (getPhase(state) === "IDLE" || restIsBetweenExercises) {
        startExercise(newExercise.id);
      }
      setShowExerciseSelector(false);
    },
    [addExercise, startExercise, session.exercises.length]
  );

  const doComplete = async () => {
    try {
      const data = await completeWorkout(session.id);
      onCompleted(data as CompletedWorkout);
      toast({ title: "Allenamento completato! 💪", description: "Ottimo lavoro!" });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare l'allenamento", variant: "destructive" });
    }
  };

  const handleFinish = () => {
    if (session.exercises.length === 0 || session.exercises.every((ex) => ex.sets.every((s) => !s.completed))) {
      setShowFinishConfirm(true);
      return;
    }
    doComplete();
  };

  return (
    <div className="bg-background pb-52">
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-30 backdrop-blur-xl border-b transition-colors",
          isResting ? "bg-amber-950/90 border-amber-500/30" : "bg-black/90 border-white/5"
        )}
      >
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon-sm" onClick={() => setShowAbandonConfirm(true)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">
                  {session.programDayName ? `Piano · ${session.programDayName}` : "Allenamento in corso"}
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-foreground">{formatClock(totalSeconds)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-lg font-bold tabular-nums">{formatVolume(totalVolume)}</p>
            </div>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleFinish}
              disabled={isCompleting}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              {isCompleting ? "Salvataggio..." : "Fine"}
            </Button>
          </div>

          {/* Totali della sessione: il tempo della fase in corso è nella barra in basso */}
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <div className="rounded-lg bg-white/5 px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Recupero totale</span>
              <span className="text-sm font-semibold tabular-nums text-amber-400">{formatClock(restSeconds)}</span>
            </div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Effettivo</span>
              <span className="text-sm font-semibold tabular-nums text-green-400">{formatClock(activeSeconds)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Exercise list */}
      <div className="container max-w-2xl mx-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {session.exercises.map((exercise, index) => (
            <motion.div
              key={exercise.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
            >
              <ExerciseCard exercise={exercise} />
            </motion.div>
          ))}
        </AnimatePresence>

        {session.exercises.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Nessun esercizio</p>
            <p className="text-sm">Aggiungi il primo esercizio per iniziare</p>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowExerciseSelector(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Esercizio
        </Button>
      </div>

      {/* Exercise Selector */}
      <AnimatePresence>
        {showExerciseSelector && (
          <ExerciseSelector
            onSelect={handleAddExercise}
            onClose={() => setShowExerciseSelector(false)}
          />
        )}
      </AnimatePresence>

      <WorkoutPhaseBar onAddExercise={() => setShowExerciseSelector(true)} />

      {/* Finish confirm */}
      <AnimatePresence>
        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowFinishConfirm(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-2">Terminare l&apos;allenamento?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Non hai completato nessuna serie. Vuoi terminare comunque?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowFinishConfirm(false)}>
                  Continua
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowFinishConfirm(false);
                    doComplete();
                  }}
                >
                  Termina
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abandon confirm */}
      <AnimatePresence>
        {showAbandonConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowAbandonConfirm(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-2">Abbandonare l&apos;allenamento?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                I progressi non verranno salvati. Sei sicuro?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowAbandonConfirm(false)}>
                  Continua
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={abandonMutation.isPending}
                  onClick={() => abandonMutation.mutate()}
                >
                  {abandonMutation.isPending ? "Uscita..." : "Abbandona"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
