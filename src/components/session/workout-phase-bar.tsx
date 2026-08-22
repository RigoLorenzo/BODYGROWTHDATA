"use client";

import { motion } from "framer-motion";
import { useSessionTimers } from "@/hooks/use-rest-timer";
import { Dumbbell, Timer, Play, Flag, Plus } from "lucide-react";
import { formatClock, cn } from "@/lib/utils";

interface Props {
  /** Apre il selettore quando non c'è nessun esercizio da iniziare */
  onAddExercise: () => void;
}

/**
 * Barra fissa in basso: guida il ciclo dell'esercizio.
 *
 *   nessun esercizio → [Inizia esercizio] → lavoro su X → [Fine esercizio]
 *   → recupero dopo X → [Inizia il prossimo] → lavoro su Y → ...
 *
 * Ogni fase è sempre legata a un esercizio preciso: senza esercizio in corso
 * non si cronometra né lavoro né recupero.
 */
export function WorkoutPhaseBar({ onAddExercise }: Props) {
  const {
    rest,
    phase,
    phaseSeconds,
    restTarget,
    currentExercise,
    nextExercise,
    endRest,
    startExercise,
    finishExercise,
  } = useSessionTimers();

  const isResting = phase === "REST";
  const target = restTarget || 90;
  const progress = Math.min(100, (phaseSeconds / target) * 100);
  const overTarget = isResting && phaseSeconds >= target;
  const label = (ex?: { exerciseName: string; exerciseNameIt?: string | null } | null) =>
    ex ? ex.exerciseNameIt ?? ex.exerciseName : "";

  // Dopo un recupero di fine esercizio si passa al prossimo; dopo un recupero
  // tra le serie si torna sullo stesso esercizio.
  const restIsBetweenExercises = rest?.kind === "EXERCISE";
  const resumeTarget = restIsBetweenExercises ? nextExercise : currentExercise;

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 px-3 pb-2"
    >
      <div
        className={cn(
          "container max-w-2xl mx-auto rounded-2xl border shadow-xl overflow-hidden backdrop-blur-xl",
          phase === "REST"
            ? "border-amber-500/50 bg-amber-500/15"
            : phase === "WORK"
              ? "border-green-500/40 bg-green-500/10"
              : "border-border bg-card"
        )}
      >
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
              {phase === "REST" ? (
                <Timer className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : phase === "WORK" ? (
                <Dumbbell className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <Dumbbell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  phase === "REST"
                    ? "text-amber-500"
                    : phase === "WORK"
                      ? "text-green-500"
                      : "text-muted-foreground"
                )}
              >
                {phase === "REST" ? "In recupero" : phase === "WORK" ? "In allenamento" : "Nessun esercizio in corso"}
              </p>
            </div>

            {phase === "IDLE" ? (
              <p className="text-sm text-muted-foreground mt-0.5">
                {nextExercise
                  ? `Inizia ${label(nextExercise)} per far partire il cronometro`
                  : "Aggiungi un esercizio per iniziare"}
              </p>
            ) : (
              <>
                <p
                  className={cn(
                    "text-3xl font-bold font-mono tabular-nums leading-tight",
                    isResting ? "text-amber-500" : "text-green-500"
                  )}
                >
                  {formatClock(phaseSeconds)}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {isResting
                      ? `${restIsBetweenExercises ? "dopo" : "durante"} ${label(currentExercise)}`
                      : label(currentExercise)}
                  </span>
                  {isResting && <span className="shrink-0">· obiettivo {formatClock(target)}</span>}
                </div>
              </>
            )}
          </div>

          {phase === "REST" ? (
            resumeTarget ? (
              <button
                onClick={() =>
                  restIsBetweenExercises ? startExercise(resumeTarget.id) : endRest()
                }
                className="shrink-0 max-w-[45%] h-14 px-4 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
              >
                <Play className="h-4 w-4" />
                <span className="truncate max-w-full">
                  {restIsBetweenExercises ? label(resumeTarget) : "Riprendi"}
                </span>
              </button>
            ) : (
              <button
                onClick={onAddExercise}
                className="shrink-0 h-14 px-4 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
              >
                <Plus className="h-4 w-4" />
                Esercizio
              </button>
            )
          ) : phase === "WORK" ? (
            <button
              onClick={() => currentExercise && finishExercise(currentExercise.id)}
              className="shrink-0 h-14 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-black font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
            >
              <Flag className="h-4 w-4" />
              Fine
            </button>
          ) : nextExercise ? (
            <button
              onClick={() => startExercise(nextExercise.id)}
              className="shrink-0 h-14 px-4 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
            >
              <Play className="h-4 w-4" />
              Inizia
            </button>
          ) : (
            <button
              onClick={onAddExercise}
              className="shrink-0 h-14 px-4 rounded-xl bg-primary text-primary-foreground active:scale-[0.98] font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all"
            >
              <Plus className="h-4 w-4" />
              Esercizio
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
