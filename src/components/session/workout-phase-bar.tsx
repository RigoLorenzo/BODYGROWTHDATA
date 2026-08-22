"use client";

import { motion } from "framer-motion";
import { useSessionTimers } from "@/hooks/use-rest-timer";
import { useSessionStore } from "@/store/session-store";
import { Dumbbell, Timer, Play, Check, Plus } from "lucide-react";
import { formatClock, cn } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

interface Props {
  /** Apre il selettore quando non c'è nessun esercizio da iniziare */
  onAddExercise: () => void;
}

const label = (ex?: ActiveExercise | null) => (ex ? ex.exerciseNameIt ?? ex.exerciseName : "");

/** Indice della prossima serie da fare (la prima non ancora registrata) */
const nextSetIndex = (ex?: ActiveExercise | null) =>
  ex ? ex.sets.findIndex((s) => !s.completed) : -1;

/**
 * Barra fissa in basso: porta avanti l'allenamento serie per serie.
 *
 *   [Fine serie] → recupero → [Prosegui: serie 2] → ... → ultima serie
 *   → recupero → [Inizia il prossimo esercizio] o [Nuovo esercizio]
 *
 * Premere "Fine serie" registra la serie corrente: non serve spuntarla a mano.
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
  const completeSet = useSessionStore((s) => s.completeSet);
  const activeSession = useSessionStore((s) => s.activeSession);

  const isResting = phase === "REST";
  const target = restTarget || 90;
  const progress = Math.min(100, (phaseSeconds / target) * 100);
  const overTarget = isResting && phaseSeconds >= target;

  // Esercizio a cui si riferisce il recupero in corso
  const restExercise = activeSession?.exercises.find((e) => e.id === rest?.exerciseId) ?? null;
  const pendingAfterRest = nextSetIndex(restExercise);
  const workingSetIndex = nextSetIndex(currentExercise);

  // Testo della fase
  let title = "Nessun esercizio in corso";
  let subtitle = nextExercise
    ? `Inizia ${label(nextExercise)} per far partire il cronometro`
    : "Aggiungi un esercizio per iniziare";

  if (phase === "WORK" && currentExercise) {
    title = "In allenamento";
    subtitle =
      workingSetIndex >= 0
        ? `${label(currentExercise)} · serie ${workingSetIndex + 1} di ${currentExercise.sets.length}`
        : label(currentExercise);
  } else if (isResting && restExercise) {
    title = "In recupero";
    subtitle =
      pendingAfterRest >= 0
        ? `${label(restExercise)} · prossima: serie ${pendingAfterRest + 1} di ${restExercise.sets.length}`
        : `dopo ${label(restExercise)}`;
  }

  // Azione principale, sempre riferita alla serie o all'esercizio in corso
  let action: { text: string; icon: typeof Play; onClick: () => void; tone: "green" | "amber" } | null = null;

  if (isResting) {
    if (restExercise && pendingAfterRest >= 0) {
      action = {
        text: `Serie ${pendingAfterRest + 1}`,
        icon: Play,
        onClick: endRest,
        tone: "green",
      };
    } else if (nextExercise) {
      action = {
        text: label(nextExercise),
        icon: Play,
        onClick: () => startExercise(nextExercise.id),
        tone: "green",
      };
    } else {
      action = { text: "Esercizio", icon: Plus, onClick: onAddExercise, tone: "green" };
    }
  } else if (phase === "WORK" && currentExercise) {
    action =
      workingSetIndex >= 0
        ? {
            text: "Fine serie",
            icon: Check,
            onClick: () => completeSet(currentExercise.id, workingSetIndex),
            tone: "amber",
          }
        : {
            text: "Fine",
            icon: Check,
            onClick: () => finishExercise(currentExercise.id),
            tone: "amber",
          };
  } else if (nextExercise) {
    action = {
      text: "Inizia",
      icon: Play,
      onClick: () => startExercise(nextExercise.id),
      tone: "green",
    };
  } else {
    action = { text: "Esercizio", icon: Plus, onClick: onAddExercise, tone: "green" };
  }

  if (!activeSession) return null;

  const ActionIcon = action.icon;

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
              ) : (
                <Dumbbell
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    phase === "WORK" ? "text-green-500" : "text-muted-foreground"
                  )}
                />
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
                {title}
              </p>
            </div>

            {phase === "IDLE" ? (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
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
                  <span className="truncate">{subtitle}</span>
                  {isResting && <span className="shrink-0">· obiettivo {formatClock(target)}</span>}
                </div>
              </>
            )}
          </div>

          <button
            onClick={action.onClick}
            className={cn(
              "shrink-0 max-w-[45%] h-14 px-4 rounded-xl active:scale-[0.98] font-semibold text-sm flex flex-col items-center justify-center gap-0.5 transition-all",
              action.tone === "green"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-black"
            )}
          >
            <ActionIcon className="h-4 w-4" />
            <span className="truncate max-w-full">{action.text}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
