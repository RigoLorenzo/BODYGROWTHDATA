"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useSessionStore, isFilledUnconfirmed } from "@/store/session-store";
import { formatLoggedSets } from "@/lib/progression";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetRow } from "./set-row";
import { Plus, ChevronDown, ChevronUp, Trash2, TrendingUp, CheckCircle2, History, Repeat } from "lucide-react";
import { ExerciseSelector } from "./exercise-selector";
import { buildActiveExercise, fetchExerciseHistory } from "@/lib/active-exercise";
import { calculateExerciseVolume } from "@/lib/volume-calculator";
import { formatVolume, cn } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

interface Props {
  exercise: ActiveExercise;
}

const formatKg = (kg?: number) => (kg == null ? "" : String(kg).replace(".", ","));

function ExerciseCardComponent({ exercise }: Props) {
  const addSet = useSessionStore((s) => s.addSet);
  const removeSet = useSessionStore((s) => s.removeSet);
  const removeExercise = useSessionStore((s) => s.removeExercise);
  const replaceExercise = useSessionStore((s) => s.replaceExercise);
  // Si chiude solo a mano: niente salti di layout mentre scorri la lista
  const [collapsed, setCollapsed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const completedSets = exercise.sets.filter((s) => s.completed);
  const allDone = exercise.sets.length > 0 && completedSets.length === exercise.sets.length;
  const unconfirmedSets = exercise.sets.filter(isFilledUnconfirmed).length;
  const volume = calculateExerciseVolume(
    completedSets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, rpe: s.rpe }))
  );
  const target = exercise.targetSets
    ? `${exercise.targetSets}×${exercise.targetRepsMin === exercise.targetRepsMax ? exercise.targetRepsMin : `${exercise.targetRepsMin}-${exercise.targetRepsMax}`}`
    : null;

  // Finita l'ultima serie, porta in vista il prossimo esercizio da fare
  const wasDone = useRef(allDone);
  useEffect(() => {
    const justFinished = allDone && !wasDone.current;
    wasDone.current = allDone;
    if (!justFinished) return;
    const next = rootRef.current?.nextElementSibling;
    if (!(next instanceof HTMLElement) || next.dataset.done !== "false") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => next.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), 450);
    return () => clearTimeout(timer);
  }, [allDone]);

  // Macchina occupata: stesso posto nella scheda, stessi obiettivi, nuovo esercizio
  const handleReplace = async (picked: { id: string; name: string; nameIt?: string | null }) => {
    setReplacing(false);
    const history = await fetchExerciseHistory([picked.id]);
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
    <div ref={rootRef} data-exercise-card data-done={allDone} className="scroll-mt-20">
      <Card className={cn("border-border/40", allDone && "border-green-500/40")}>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="flex-1 min-w-0 text-left touch-manipulation"
              onClick={() => setCollapsed((v) => !v)}
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
                aria-label={collapsed ? "Espandi" : "Comprimi"}
                className="text-muted-foreground"
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
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

        {!collapsed && (
          <CardContent className="p-3 pt-2 space-y-1">
            {exercise.notes && <p className="text-xs text-primary/80 px-1">{exercise.notes}</p>}

            {exercise.lastSets && (
              <div className="space-y-1 px-1 text-xs text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  <History className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
                  <span>
                    Ultima volta: <span className="font-semibold text-foreground">{formatLoggedSets(exercise.lastSets)}</span>
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
