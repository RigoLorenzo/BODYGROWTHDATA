"use client";

import { useState } from "react";
import {
  useSessionStore,
  getRestAfterSet,
  getRestAfterExercise,
} from "@/store/session-store";
import { useLastExerciseSession } from "@/hooks/use-workout-session";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetRow } from "./set-row";
import { Plus, ChevronDown, ChevronUp, Trash2, TrendingUp, Flag, Play, Timer } from "lucide-react";
import { calculateExerciseVolume } from "@/lib/volume-calculator";
import { formatVolume, formatClock } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

interface Props {
  exercise: ActiveExercise;
}

export function ExerciseCard({ exercise }: Props) {
  const { addSet, removeExercise, removeSet, finishExercise, resumeExercise } = useSessionStore();
  const activeSession = useSessionStore((s) => s.activeSession);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: lastSession } = useLastExerciseSession(exercise.exerciseId);

  const completedSets = exercise.sets.filter((s) => s.completed);
  const volume = calculateExerciseVolume(
    completedSets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, rpe: s.rpe }))
  );

  const restAfterExercise = getRestAfterExercise(activeSession, exercise.id);
  const setRests = exercise.sets
    .map((_, i) => getRestAfterSet(activeSession, exercise.id, i))
    .filter((v): v is number => typeof v === "number");
  const avgSetRest = setRests.length
    ? Math.round(setRests.reduce((a, b) => a + b, 0) / setRests.length)
    : undefined;

  const handleAddSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    addSet(exercise.id, {
      setNumber: exercise.sets.length + 1,
      type: "WORKING",
      weight: lastSet?.weight,
      reps: lastSet?.reps,
      completed: false,
    });
  };

  return (
    <Card className={exercise.finished ? "border-green-600/30 bg-green-600/5" : "border-border/30 transition-colors hover:border-border/60"}>
      <CardHeader className="p-3 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm leading-tight tracking-tight">{exercise.exerciseName}</h3>
              {exercise.fromPlan && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                  Dal piano
                </span>
              )}
              {exercise.finished && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-600/15 text-green-400 font-medium shrink-0">
                  Terminato
                </span>
              )}
            </div>
            {exercise.exerciseNameIt && (
              <p className="text-xs text-muted-foreground/80 leading-tight">{exercise.exerciseNameIt}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {completedSets.length}/{exercise.sets.length} serie · {formatVolume(volume)}
              {exercise.targetSets ? ` · piano ${exercise.targetSets}×${exercise.targetRepsMin}-${exercise.targetRepsMax}` : ""}
              {avgSetRest ? ` · rec. medio ${formatClock(avgSetRest)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground h-7 w-7"
              onClick={() => removeExercise(exercise.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground h-7 w-7"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="p-3 pt-2 space-y-1.5">
          {/* Previous session hint */}
          {lastSession && lastSession.maxWeight > 0 && (
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-primary/8 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-primary/70" />
                <span>Ultima: <span className="font-semibold text-foreground">{lastSession.maxWeight}kg × {lastSession.maxReps}</span></span>
              </div>
              <span className="text-muted-foreground/60">~{lastSession.oneRM}kg 1RM</span>
            </div>
          )}
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground font-medium px-1">
            <span className="col-span-1">#</span>
            <span className="col-span-2 text-center">Tipo</span>
            <span className="col-span-3 text-center">Peso (kg)</span>
            <span className="col-span-3 text-center">Reps</span>
            <span className="col-span-2 text-center">✓</span>
            <span className="col-span-1"></span>
          </div>

          {exercise.sets.map((set, index) => (
            <SetRow
              key={`${exercise.id}-${index}`}
              exerciseId={exercise.id}
              set={set}
              index={index}
              restSeconds={getRestAfterSet(activeSession, exercise.id, index)}
              onRemove={() => removeSet(exercise.id, index)}
            />
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground border border-dashed border-border/50 hover:border-border"
            onClick={handleAddSet}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Aggiungi serie
          </Button>

          {/* Fine / ricomincia esercizio */}
          {exercise.finished ? (
            <div className="space-y-1.5">
              {typeof restAfterExercise === "number" && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  Recupero dopo l&apos;esercizio: <span className="font-semibold text-foreground">{formatClock(restAfterExercise)}</span>
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs border-green-600/40 text-green-400 hover:bg-green-600/10"
                onClick={() => resumeExercise(exercise.id)}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Ricomincia esercizio
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => finishExercise(exercise.id)}
            >
              <Flag className="h-3.5 w-3.5 mr-1" />
              Fine esercizio — avvia recupero
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
