"use client";

import { useState } from "react";
import { useSessionStore } from "@/store/session-store";
import { useLastExerciseSession } from "@/hooks/use-workout-session";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetRow } from "./set-row";
import { Plus, ChevronDown, ChevronUp, Trash2, TrendingUp } from "lucide-react";
import { calculateExerciseVolume } from "@/lib/volume-calculator";
import { formatVolume } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

interface Props {
  exercise: ActiveExercise;
}

export function ExerciseCard({ exercise }: Props) {
  const { addSet, removeExercise } = useSessionStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: lastSession } = useLastExerciseSession(exercise.exerciseId);

  const completedSets = exercise.sets.filter((s) => s.completed);
  const volume = calculateExerciseVolume(
    completedSets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, rpe: s.rpe }))
  );

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
    <Card className="border-border/50">
      <CardHeader className="p-3 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight">{exercise.exerciseName}</h3>
            <p className="text-xs text-muted-foreground">
              {completedSets.length}/{exercise.sets.length} serie · {formatVolume(volume)}
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
            <span className="col-span-3 text-center">Tipo</span>
            <span className="col-span-3 text-center">Peso (kg)</span>
            <span className="col-span-3 text-center">Reps</span>
            <span className="col-span-2 text-center">✓</span>
          </div>

          {exercise.sets.map((set, index) => (
            <SetRow
              key={`${exercise.id}-${index}`}
              exerciseId={exercise.id}
              set={set}
              index={index}
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
        </CardContent>
      )}
    </Card>
  );
}
