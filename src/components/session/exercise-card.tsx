"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AnimatePresence } from "framer-motion";
import { useSessionStore, isFilledUnconfirmed } from "@/store/session-store";
import { formatLoggedSets } from "@/lib/progression";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetRow } from "./set-row";
import { Plus, ChevronDown, ChevronUp, Trash2, TrendingUp, CheckCircle2, History, Repeat } from "lucide-react";
import { ExerciseSelector } from "./exercise-selector";
import { ExerciseNote } from "./exercise-note";
import { buildActiveExercise, fetchExerciseHistory } from "@/lib/active-exercise";
import { calculateExerciseVolume } from "@/lib/volume-calculator";
import { formatVolume, cn } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

interface Props {
  exercise: ActiveExercise;
  /** Tendina aperta: la decide la lista, all'avvio sono tutte chiuse */
  expanded: boolean;
  onToggle: (exerciseId: string) => void;
  /** Chiamata quando l'ultima serie viene spuntata */
  onFinished?: (exerciseId: string) => void;
}

const formatKg = (kg?: number) => (kg == null ? "" : String(kg).replace(".", ","));

/** "stesso giorno · 12 ott" oppure "12 ott" */
function lastTimeLabel(exercise: ActiveExercise): string {
  const date = exercise.lastDate ? new Date(exercise.lastDate) : null;
  const day = date && !Number.isNaN(date.getTime()) ? format(date, "d MMM", { locale: it }) : null;
  return [exercise.lastSameDay ? "stesso giorno" : null, day].filter(Boolean).join(" · ");
}

function ExerciseCardComponent({ exercise, expanded, onToggle, onFinished }: Props) {
  const addSet = useSessionStore((s) => s.addSet);
  const removeSet = useSessionStore((s) => s.removeSet);
  const removeExercise = useSessionStore((s) => s.removeExercise);
  const replaceExercise = useSessionStore((s) => s.replaceExercise);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const completedSets = exercise.sets.filter((s) => s.completed);
  const allDone = exercise.sets.length > 0 && completedSets.length === exercise.sets.length;
  const unconfirmedSets = exercise.sets.filter(isFilledUnconfirmed).length;
  const volume = calculateExerciseVolume(
    completedSets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, rpe: s.rpe }))
  );
  const target = exercise.targetSets
    ? `${exercise.targetSets}×${exercise.targetRepsMin === exercise.targetRepsMax ? exercise.targetRepsMin : `${exercise.targetRepsMin}-${exercise.targetRepsMax}`}`
    : null;

  const lastLabel = lastTimeLabel(exercise);
  const toggle = () => onToggle(exercise.id);

  // Finita l'ultima serie la lista apre e porta in vista il prossimo esercizio
  const wasDone = useRef(allDone);
  useEffect(() => {
    const justFinished = allDone && !wasDone.current;
    wasDone.current = allDone;
    if (justFinished) onFinished?.(exercise.id);
  }, [allDone, exercise.id, onFinished]);

  // Macchina occupata: stesso posto nella scheda, stessi obiettivi, nuovo esercizio
  const handleReplace = async (picked: { id: string; name: string; nameIt?: string | null }) => {
    setReplacing(false);
    const programDayId = useSessionStore.getState().activeSession?.programDayId;
    const history = await fetchExerciseHistory([picked.id], programDayId);
    replaceExercise(
      exercise.id,
      buildActiveExercise(
        {
          id: exercise.id,
          exerciseId: picked.id,
          exerciseName: picked.name,
          exerciseNameIt: picked.nameIt,
          orderIndex: exercise.orderIndex,
          restSeconds: exercise.restTimerSeconds,
          sets: exercise.targetSets ?? exercise.sets.length,
          repsMin: exercise.targetRepsMin,
          repsMax: exercise.targetRepsMax,
          notes: exercise.notes,
          fromPlan: exercise.fromPlan,
        },
        history[picked.id]
      )
    );
  };

  const handleRemoveSet = useCallback((index: number) => removeSet(exercise.id, index), [removeSet, exercise.id]);

  const handleAddSet = () => {
    // Riparte dall'ultima serie con dei dati, non dall'ultima in assoluto
    const reference = [...exercise.sets].reverse().find((s) => s.weight != null || s.reps != null);
    addSet(exercise.id, {
      setNumber: exercise.sets.length + 1,
      type: reference?.type === "WARMUP" ? "WORKING" : reference?.type ?? "WORKING",
      weight: reference?.weight,
      reps: reference?.reps,
      // Valori proposti: diventano "inseriti" appena li tocchi o li confermi
      prefilled: reference != null,
      completed: false,
    });
  };

  return (
    <div data-exercise-card={exercise.id} data-done={allDone} className="scroll-mt-20">
      <Card className={cn("border-border/40", allDone && "border-green-500/40")}>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="flex-1 min-w-0 text-left touch-manipulation"
              aria-expanded={expanded}
              aria-controls={`sets-${exercise.id}`}
              onClick={toggle}
            >
              <div className="flex items-center gap-1.5">
                {allDone && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                <h3 className="font-semibold text-sm leading-tight tracking-tight truncate">
                  {exercise.exerciseName}
                </h3>
              </div>
              {exercise.exerciseNameIt && (
                <p className="text-xs text-muted-foreground/80 leading-tight truncate">{exercise.exerciseNameIt}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className={cn("font-semibold tabular-nums", allDone ? "text-green-500" : "text-foreground")}>
                  {completedSets.length}/{exercise.sets.length}
                </span>{" "}
                serie
                {target ? ` · piano ${target}` : ""}
                {volume > 0 ? ` · ${formatVolume(volume)}` : ""}
                {!expanded && exercise.progression ? ` · scorsa ${formatKg(exercise.progression.previousTop)} kg` : ""}
              </p>
            </button>
            <div className="flex items-center">
              {completedSets.length === 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sostituisci esercizio"
                  title="Sostituisci (es. macchina occupata)"
                  className="text-muted-foreground"
                  onClick={() => setReplacing(true)}
                >
                  <Repeat className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Rimuovi esercizio"
                className="text-muted-foreground"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={expanded ? "Comprimi" : "Espandi"}
                aria-expanded={expanded}
                aria-controls={`sets-${exercise.id}`}
                className="text-muted-foreground"
                onClick={toggle}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {confirmRemove && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-2 py-1.5">
              <span className="text-xs">Rimuovere l&apos;esercizio?</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmRemove(false)}>
                  Annulla
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs"
                  onClick={() => removeExercise(exercise.id)}
                >
                  Rimuovi
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        {expanded && (
          <CardContent id={`sets-${exercise.id}`} className="p-3 pt-2 space-y-1">
            <ExerciseNote exercise={exercise} />

            {exercise.lastSets && (
              <div className="space-y-1 px-1 text-xs text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  <History className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
                  <span>
                    Ultima volta{lastLabel ? ` (${lastLabel})` : ""}:{" "}
                    <span className="font-semibold text-foreground">{formatLoggedSets(exercise.lastSets)}</span>
                  </span>
                </p>
                {exercise.progression?.increase && (
                  <p className="flex items-center gap-1.5 font-medium text-green-600 dark:text-green-400">
                    <TrendingUp className="h-3 w-3 shrink-0" />
                    Hai chiuso tutte le ripetizioni: oggi prova{" "}
                    {formatKg(exercise.sets[0]?.weight)} kg
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_3.5rem_2.5rem_1.25rem] gap-1.5 px-1 pt-1 text-[10px] text-muted-foreground font-medium">
              <span className="text-center">#</span>
              <span className="text-center">Peso (kg)</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Fatta</span>
              <span />
            </div>

            {exercise.sets.map((set, index) => (
              <SetRow
                key={`${exercise.id}-${index}`}
                exerciseId={exercise.id}
                set={set}
                index={index}
                previous={exercise.lastSets?.[index]}
                onRemove={handleRemoveSet}
              />
            ))}

            <Button
              variant="ghost"
              size="sm"
              className="w-full h-10 text-xs text-muted-foreground border border-dashed border-border/50 touch-manipulation"
              onClick={handleAddSet}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Aggiungi serie
            </Button>

            {unconfirmedSets > 0 && (
              <p className="text-[11px] text-muted-foreground text-center">
                {unconfirmedSets === 1 ? "1 serie compilata" : `${unconfirmedSets} serie compilate`} senza spunta:
                verranno registrate a fine allenamento.
              </p>
            )}
          </CardContent>
        )}
      </Card>
      <AnimatePresence>
        {replacing && <ExerciseSelector onSelect={handleReplace} onClose={() => setReplacing(false)} />}
      </AnimatePresence>
    </div>
  );
}

/** Si ridisegna solo quando cambia il suo esercizio */
export const ExerciseCard = memo(ExerciseCardComponent);
