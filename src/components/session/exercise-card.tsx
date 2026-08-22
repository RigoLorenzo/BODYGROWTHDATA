"use client";

import { useState } from "react";
import {
  useSessionStore,
  getOpenRest,
  getRestAfterSet,
  getRestAfterExercise,
  getExerciseWorkSeconds,
} from "@/store/session-store";
import { useLastExerciseSession } from "@/hooks/use-workout-session";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetRow } from "./set-row";
import { Plus, ChevronDown, ChevronUp, Trash2, TrendingUp, Flag, Play, Timer, Dumbbell } from "lucide-react";
import { calculateExerciseVolume } from "@/lib/volume-calculator";
import { formatVolume, formatClock } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

interface Props {
  exercise: ActiveExercise;
}

export function ExerciseCard({ exercise }: Props) {
  const { addSet, removeExercise, removeSet, startExercise, finishExercise } = useSessionStore();
  const activeSession = useSessionStore((s) => s.activeSession);
  // Gli esercizi terminati si chiudono da soli, ma la scelta manuale vince
  const [manualCollapse, setManualCollapse] = useState<boolean | null>(null);
  const { data: lastSession } = useLastExerciseSession(exercise.exerciseId);

  const completedSets = exercise.sets.filter((s) => s.completed);
  const volume = calculateExerciseVolume(
    completedSets.map((s) => ({ weight: s.weight, reps: s.reps, type: s.type, rpe: s.rpe }))
  );

  const openRest = getOpenRest(activeSession);
  const isRestingHere = openRest?.exerciseId === exercise.id;
  const isRestingElsewhere = !!openRest && !isRestingHere;
  const isCurrent = activeSession?.currentExerciseId === exercise.id;
  const isWorking = isCurrent && !!exercise.startedAt && !exercise.finishedAt && !openRest;
  const workSeconds = getExerciseWorkSeconds(activeSession, exercise.id);
  const isCollapsed = manualCollapse ?? (!!exercise.finishedAt && !isRestingHere);
  const restAfterExercise = getRestAfterExercise(activeSession, exercise.id);
  const setRests = exercise.sets
    .map((_, i) => getRestAfterSet(activeSession, exercise.id, i))
    .filter((v): v is number => typeof v === "number");
  const avgSetRest = setRests.length
    ? Math.round(setRests.reduce((a, b) => a + b, 0) / setRests.length)
    : undefined;
  // Serie con dati inseriti ma non ancora confermate col ✓
  const unconfirmedSets = exercise.sets.filter(
    (s) => !s.completed && !s.prefilled && (s.weight != null || s.reps != null)
  ).length;
  const pendingSetNumber = exercise.sets.findIndex((s) => !s.completed) + 1;

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
    <Card
      className={
        isWorking
          ? "border-green-500/50 bg-green-500/5"
          : isRestingHere
            ? "border-amber-500/50 bg-amber-500/5"
            : exercise.finishedAt
              ? "border-border/30 opacity-90"
              : "border-border/30 transition-colors hover:border-border/60"
      }
    >
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
              {isWorking && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-600/15 text-green-500 font-medium shrink-0">
                  In corso
                </span>
              )}
              {isRestingHere && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-medium shrink-0">
                  In recupero
                </span>
              )}
              {exercise.finishedAt && !isRestingHere && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
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
              {exercise.startedAt ? ` · lavoro ${formatClock(workSeconds)}` : ""}
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
              onClick={() => setManualCollapse(!isCollapsed)}
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

          {unconfirmedSets > 0 && !exercise.finishedAt && (
            <p className="text-[11px] text-muted-foreground text-center">
              {unconfirmedSets === 1 ? "1 serie compilata" : `${unconfirmedSets} serie compilate`} non ancora
              registrate: usa &ldquo;Fine serie&rdquo; nella barra in basso oppure il ✓.
            </p>
          )}

          {exercise.finishedAt && completedSets.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center">
              Esercizio svolto senza serie registrate.
            </p>
          )}

          {/* Ciclo dell'esercizio: inizia → fine → recupero */}
          {isRestingHere ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-amber-500 py-1.5 text-center">
              <Timer className="h-3 w-3 shrink-0" />
              {pendingSetNumber > 0
                ? `Recupero prima della serie ${pendingSetNumber} — prosegui dalla barra in basso`
                : "Recupero dopo questo esercizio — dalla barra in basso passi al prossimo"}
            </p>
          ) : isWorking ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => finishExercise(exercise.id)}
            >
              <Flag className="h-3.5 w-3.5 mr-1" />
              Termina esercizio senza le serie rimanenti
            </Button>
          ) : (
            <div className="space-y-1.5">
              {exercise.finishedAt && typeof restAfterExercise === "number" && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  Lavoro <span className="font-semibold text-foreground">{formatClock(workSeconds)}</span>
                  · recupero dopo <span className="font-semibold text-foreground">{formatClock(restAfterExercise)}</span>
                </p>
              )}
              <Button
                size="sm"
                variant={exercise.finishedAt ? "outline" : "default"}
                className="w-full text-xs"
                disabled={isRestingElsewhere}
                onClick={() => startExercise(exercise.id)}
              >
                {exercise.finishedAt ? (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Riprendi questo esercizio
                  </>
                ) : (
                  <>
                    <Dumbbell className="h-3.5 w-3.5 mr-1" />
                    Inizia esercizio
                  </>
                )}
              </Button>
              {isRestingElsewhere && (
                <p className="text-[10px] text-center text-muted-foreground">
                  Sei in recupero su un altro esercizio
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
