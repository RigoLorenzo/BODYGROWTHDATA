"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionStore } from "@/store/session-store";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useRestTimer } from "@/hooks/use-rest-timer";
import { Button } from "@/components/ui/button";
import { ExerciseCard } from "./exercise-card";
import { ExerciseSelector } from "./exercise-selector";
import { RestTimerOverlay } from "./rest-timer-overlay";
import { formatWorkoutDuration, formatVolume } from "@/lib/utils";
import { calculateSessionVolume } from "@/lib/volume-calculator";
import { Plus, CheckCircle, X, Timer } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ActiveSession, ActiveExercise, ActiveSet } from "@/types";

interface Props {
  session: ActiveSession;
}

export function ActiveWorkoutView({ session }: Props) {
  const { addExercise, endSession } = useSessionStore();
  const { completeWorkout, isCompleting } = useWorkoutSession();
  const { restTimer } = useRestTimer();
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  useEffect(() => {
    const update = () => setElapsed(formatWorkoutDuration(new Date(session.startedAt)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  const totalVolume = calculateSessionVolume(
    session.exercises.map((ex) => ({ sets: ex.sets.filter((s) => s.completed) }))
  );

  const handleAddExercise = useCallback(
    (exercise: { id: string; name: string }) => {
      const newExercise: ActiveExercise = {
        id: `ex-${Date.now()}`,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        orderIndex: session.exercises.length,
        restTimerSeconds: 90,
        sets: [
          { setNumber: 1, type: "WORKING", completed: false },
        ],
      };
      addExercise(newExercise);
      setShowExerciseSelector(false);
    },
    [addExercise, session.exercises.length]
  );

  const handleFinish = () => {
    if (session.exercises.length === 0 || session.exercises.every((ex) => ex.sets.every((s) => !s.completed))) {
      setShowFinishConfirm(true);
      return;
    }
    completeWorkout(session.id);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Allenamento in corso</p>
              <p className="text-xl font-bold tabular-nums text-green-400">{elapsed}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Volume totale</p>
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
        </div>
      </div>

      {/* Rest Timer */}
      <AnimatePresence>
        {restTimer && <RestTimerOverlay />}
      </AnimatePresence>

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
              <h3 className="font-bold text-lg mb-2">Terminare l'allenamento?</h3>
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
                    completeWorkout(session.id);
                    setShowFinishConfirm(false);
                  }}
                >
                  Termina
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
