"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, History, Plus, Unlink2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSuperset } from "@/hooks/use-superset";
import { formatLoggedSets } from "@/lib/progression";
import { interleave } from "@/lib/superset";
import { calculateExerciseVolume } from "@/lib/volume-calculator";
import { cn, formatVolume } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import type { ActiveExercise } from "@/types";
import { lastTimeLabel, newSetFor } from "./exercise-card";
import { ExerciseNote } from "./exercise-note";
import { SetRow, setGrid } from "./set-row";

const LETTERS = ["A", "B"] as const;

const target = (ex: ActiveExercise) =>
  ex.targetSets
    ? `${ex.targetSets}×${ex.targetRepsMin === ex.targetRepsMax ? ex.targetRepsMin : `${ex.targetRepsMin}-${ex.targetRepsMax}`}`
    : null;

function Letter({ which }: { which: 0 | 1 }) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
        which === 0 ? "bg-foreground text-background" : "bg-brand text-brand-foreground"
      )}
      aria-hidden
    >
      {LETTERS[which]}
    </span>
  );
}

/** Nota e serie dell'ultima volta di un esercizio della coppia */
function ExerciseContext({ exercise, which }: { exercise: ActiveExercise; which: 0 | 1 }) {
  const last = lastTimeLabel(exercise);
  return (
    <div className="space-y-0.5 border-l-2 border-border/60 pl-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Letter which={which} /> <span className="truncate">{exercise.exerciseNameIt || exercise.exerciseName}</span>
      </p>
      <ExerciseNote exercise={exercise} />
      {exercise.lastSets && (
        <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
          <History className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" aria-hidden />
          <span>
            Ultima volta{last ? ` (${last})` : ""}:{" "}
            <span className="font-semibold text-foreground">{formatLoggedSets(exercise.lastSets)}</span>
          </span>
        </p>
      )}
    </div>
  );
}

interface Props {
  first: ActiveExercise;
  second: ActiveExercise;
  expanded: boolean;
  onToggle: (exerciseId: string) => void;
  onFinished?: (exerciseId: string) => void;
}

/**
 * Due esercizi in superset in un blocco solo: le serie si alternano
 * (A1, B1, A2, B2…) come le fai davvero. "Aggiungi giro" aggiunge una
 * serie a entrambi; lo scollegamento li riporta separati.
 */
function SupersetCardComponent({ first, second, expanded, onToggle, onFinished }: Props) {
  const addSet = useSessionStore((s) => s.addSet);
  const removeSet = useSessionStore((s) => s.removeSet);
  const { unlink } = useSuperset();
  const pair = [first, second] as const;

  const all = [...first.sets, ...second.sets];
  const done = all.filter((s) => s.completed).length;
  const allDone = all.length > 0 && done === all.length;
  const volume = pair.reduce(
    (sum, ex) => sum + calculateExerciseVolume(ex.sets.filter((s) => s.completed).map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, rpe: s.rpe }))),
    0
  );

  // Finito il giro completo, si apre l'esercizio successivo
  const wasDone = useRef(allDone);
  useEffect(() => {
    const justFinished = allDone && !wasDone.current;
    wasDone.current = allDone;
    if (justFinished) onFinished?.(second.id);
  }, [allDone, second.id, onFinished]);

  const removeFirst = useCallback((index: number) => removeSet(first.id, index), [removeSet, first.id]);
  const removeSecond = useCallback((index: number) => removeSet(second.id, index), [removeSet, second.id]);
  const toggle = () => onToggle(first.id);

  return (
    <div data-exercise-card={first.id} data-done={allDone} className="scroll-mt-20">
      <Card className={cn("border-brand/40", allDone && "border-success/40")}>
        <CardHeader className="p-3 pb-0">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-w-0 flex-1 space-y-1 text-left touch-manipulation" aria-expanded={expanded} onClick={toggle}>
              <span className="inline-block rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-strong">
                Superset
              </span>
              {pair.map((ex, i) => (
                <span key={ex.id} className="flex items-center gap-1.5">
                  <Letter which={i as 0 | 1} />
                  <span className="truncate text-sm font-semibold leading-tight">{ex.exerciseNameIt || ex.exerciseName}</span>
                  {target(ex) && <span className="shrink-0 text-xs text-muted-foreground">{target(ex)}</span>}
                </span>
              ))}
              <span className="block text-xs text-muted-foreground">
                <span className={cn("font-semibold tabular-nums", allDone ? "text-success" : "text-foreground")}>
                  {done}/{all.length}
                </span>{" "}
                serie a giri alternati{volume > 0 ? ` · ${formatVolume(volume)}` : ""}
              </span>
            </button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Separa il superset"
                title="Separa il superset"
                className="text-muted-foreground"
                onClick={() => unlink(first.id)}
              >
                <Unlink2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={expanded ? "Comprimi" : "Espandi"}
                aria-expanded={expanded}
                className="text-muted-foreground"
                onClick={toggle}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-2 p-3 pt-3">
            {pair.map((ex, i) => (
              <ExerciseContext key={ex.id} exercise={ex} which={i as 0 | 1} />
            ))}

            <div className={cn(setGrid(true), "px-1 pt-1 text-[11px] font-medium text-muted-foreground")}>
              <span className="text-center">#</span>
              <span className="text-center">Peso (kg)</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Fatta</span>
              <span />
            </div>

            <div className="space-y-1">
              {interleave(first.sets.length, second.sets.length).map(({ which, index }) => {
                const ex = pair[which];
                return (
                  <div key={`${ex.id}-${index}`} className={cn(which === 1 && index < first.sets.length && "-mt-1")}>
                    <SetRow
                      exerciseId={ex.id}
                      set={ex.sets[index]}
                      index={index}
                      previous={ex.lastSets?.[index]}
                      onRemove={which === 0 ? removeFirst : removeSecond}
                      label={`${LETTERS[which]}${index + 1}`}
                    />
                  </div>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-full border border-dashed border-border/50 text-xs text-muted-foreground touch-manipulation"
              onClick={() => {
                addSet(first.id, newSetFor(first));
                addSet(second.id, newSetFor(second));
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Aggiungi giro
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export const SupersetCard = memo(SupersetCardComponent);
