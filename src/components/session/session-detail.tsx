"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatVolume, formatWorkoutDuration, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import { Star, Clock, Weight, Repeat, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface SetData {
  id: string;
  setNumber: number;
  type: string;
  weight?: number | null;
  reps?: number | null;
  volume?: number;
}

interface ExerciseData {
  id: string;
  exercise?: { name: string; primaryMuscle?: string };
  sets: SetData[];
}

interface PersonalRecord {
  id: string;
  recordType: string;
  value: number;
  exercise?: { name: string };
}

interface WorkoutDetail {
  personalRecords?: PersonalRecord[];
  startedAt: string | Date;
  endedAt?: string | Date;
  totalVolume: number;
  totalSets: number;
  exercises: ExerciseData[];
}

interface Props {
  workout: WorkoutDetail;
}

const setTypeLabel: Record<string, string> = {
  WARMUP: "Riscaldamento",
  WORKING: "Lavoro",
  DROPSET: "Drop Set",
  FAILURE: "Cedimento",
  MYOREP: "Myo-rep",
};

export function SessionDetail({ workout }: Props) {
  const prs = workout.personalRecords ?? [];

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/dashboard"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Dettaglio Allenamento</h1>
          <p className="text-sm text-muted-foreground">{formatDate(workout.startedAt)}</p>
        </div>
      </div>

      {/* Summary */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold tabular-nums">{formatWorkoutDuration(workout.startedAt, workout.endedAt)}</p>
              <p className="text-[10px] text-muted-foreground">Durata</p>
            </div>
            <div className="text-center">
              <Weight className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold tabular-nums">{formatVolume(workout.totalVolume)}</p>
              <p className="text-[10px] text-muted-foreground">Volume</p>
            </div>
            <div className="text-center">
              <Repeat className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold tabular-nums">{workout.totalSets}</p>
              <p className="text-[10px] text-muted-foreground">Serie</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PRs */}
      {prs.length > 0 && (
        <Card className="border-green-600/30 bg-green-600/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-400" />
              <p className="font-semibold text-sm">Nuovi Personal Records! 🎉</p>
            </div>
            <div className="space-y-1">
              {prs.map((pr: PersonalRecord) => (
                <div key={pr.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{pr.exercise?.name}</span>
                  <Badge variant="success">{pr.recordType}: {pr.value.toFixed(1)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exercises */}
      <div className="space-y-3">
        {workout.exercises.map((ex: ExerciseData) => (
          <Card key={ex.id} className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{ex.exercise?.name}</CardTitle>
                {ex.exercise?.primaryMuscle && (
                  <Badge style={{ background: `${getMuscleColor(ex.exercise.primaryMuscle)}20`, color: getMuscleColor(ex.exercise.primaryMuscle), borderColor: `${getMuscleColor(ex.exercise.primaryMuscle)}40` }} className="border text-[10px]">
                    {getMuscleLabel(ex.exercise.primaryMuscle)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5">
                <div className="grid grid-cols-5 gap-2 text-[10px] text-muted-foreground font-medium">
                  <span>Serie</span>
                  <span>Tipo</span>
                  <span className="text-right">Peso</span>
                  <span className="text-right">Reps</span>
                  <span className="text-right">Volume</span>
                </div>
                <Separator />
                {ex.sets.map((set: SetData) => (
                  <div key={set.id} className="grid grid-cols-5 gap-2 text-xs">
                    <span className="tabular-nums">{set.setNumber}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {setTypeLabel[set.type] ?? set.type}
                    </span>
                    <span className="text-right tabular-nums">{set.weight ? `${set.weight}kg` : "-"}</span>
                    <span className="text-right tabular-nums">{set.reps ?? "-"}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {set.volume > 0 ? `${set.volume.toFixed(0)}kg` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
