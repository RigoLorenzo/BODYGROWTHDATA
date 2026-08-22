"use client";

import { motion } from "framer-motion";
import { useSessionTimers } from "@/hooks/use-rest-timer";
import { useSessionStore } from "@/store/session-store";
import { Dumbbell, Timer, Play, Flag } from "lucide-react";
import { formatClock, cn } from "@/lib/utils";

interface Props {
  /** Esercizio da chiudere quando si preme "Fine esercizio" */
  currentExerciseId?: string;
}

/**
 * Barra fissa in basso: dice sempre in quale fase sei (allenamento o recupero),
 * da quanto dura, e offre l'unico pulsante che cambia fase.
 */
export function WorkoutPhaseBar({ currentExerciseId }: Props) {
  const { rest, isResting, phaseSeconds, restTarget, endRest, finishExercise } = useSessionTimers();
  const activeSession = useSessionStore((s) => s.activeSession);

  if (!activeSession) return null;

  const restingExercise = activeSession.exercises.find((e) => e.id === rest?.exerciseId);
  const currentExercise = activeSession.exercises.find((e) => e.id === currentExerciseId);
  const target = restTarget || 90;
  const progress = Math.min(100, (phaseSeconds / target) * 100);
  const overTarget = isResting && phaseSeconds >= target;

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 px-3 pb-2"
    >
      <div
        className={cn(
          "container max-w-2xl mx-auto rounded-2xl border shadow-xl overflow-hidden backdrop-blur-xl",
          isResting ? "border-amber-500/50 bg-amber-500/15" : "border-green-500/40 bg-green-500/10"
        )}
      >
        {/* Avanzamento verso il recupero obiettivo */}
        {isResting && (
          <div className="h-1 w-full bg-black/10">
            <div
              className={cn("h-full transition-all duration-1000", overTarget ? "bg-green-500" : "bg-amber-500")}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isResting ? (
                <Timer className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Dumbbell className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  isResting ? "text-amber-500" : "text-green-500"
                )}
              >
                {isResting ? "In recupero" : "In allenamento"}
              </p>
            </div>
            <p className={cn("text-3xl font-bold font-mono tabular-nums leading-tight", isResting ? "text-amber-500" : "text-green-500")}>
              {formatClock(phaseSeconds)}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="truncate">
                {isResting
                  ? `dopo ${restingExercise?.exerciseNameIt ?? restingExercise?.exerciseName ?? "l'esercizio"}`
                  : currentExercise
                    ? currentExercise.exerciseNameIt ?? currentExercise.exerciseName
                    : "Aggiungi un esercizio per iniziare"}
              </span>
              {isResting && <span className="shrink-0">· obiettivo {formatClock(target)}</span>}
            </div>
          </div>

          {isResting ? (
            <button
              onClick={endRest}
              className="shrink-0 h-14 px-5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
            >
              <Play className="h-4 w-4" />
              Riprendi
            </button>
          ) : (
            <button
              onClick={() => currentExerciseId && finishExercise(currentExerciseId)}
              disabled={!currentExerciseId}
              className="shrink-0 h-14 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 active:scale-[0.98] text-black font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
            >
              <Flag className="h-4 w-4" />
              Recupero
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
