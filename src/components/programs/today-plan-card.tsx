"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronRight, Dumbbell, Play } from "lucide-react";
import { getMuscleColor } from "@/lib/utils";
import Link from "next/link";
import { useWorkoutSession } from "@/hooks/use-workout-session";

interface PlanExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds?: number;
  exercise: { id: string; name: string; primaryMuscle: string | null } | null;
}

interface TodayPlan {
  programId: string;
  currentDay: number;
  totalDays: number;
  weekProgress: number;
  program: { name: string; durationWeeks: number; frequency: number };
  todayDay: {
    id: string;
    name: string;
    workoutType: string;
    exercises: PlanExercise[];
  } | null;
}

export function TodayPlanCard() {
  const queryClient = useQueryClient();
  const { startWorkout, isLoading } = useWorkoutSession();

  const { data: active, isLoading: loadingPlan } = useQuery<TodayPlan | null>({
    queryKey: ["programs", "active"],
    queryFn: async () => {
      const res = await fetch("/api/programs/active");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/programs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "active"] });
    },
  });

  if (loadingPlan || !active?.todayDay) return null;

  const { todayDay, program, currentDay, totalDays } = active;
  const dayNum = (currentDay % totalDays) + 1;

  const handleStart = () => {
    const planExercises = todayDay.exercises
      .filter((ex) => ex.exercise)
      .map((ex) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exercise!.name,
        restSeconds: ex.restSeconds,
      }));

    startWorkout(
      {
        workoutType: todayDay.workoutType as "PUSH" | "PULL" | "LEGS" | "UPPER" | "LOWER" | "FULL_BODY" | "CARDIO" | "CUSTOM",
        programDayId: todayDay.id,
      },
      planExercises
    );
    advanceMutation.mutate();
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] text-primary font-medium uppercase tracking-wide">Piano attivo</p>
            </div>
            <p className="font-semibold text-sm">{program.name}</p>
            <p className="text-xs text-muted-foreground">
              Giorno {dayNum}/{totalDays} · {todayDay.name}
            </p>
          </div>
          <Link href="/programs" className="text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {todayDay.exercises.length > 0 ? (
          <>
            <div className="space-y-1.5 mb-3">
              {todayDay.exercises.slice(0, 4).map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Dumbbell className="h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="text-xs flex-1 truncate">{ex.exercise?.name ?? "Esercizio"}</p>
                  <p className="text-[10px] text-muted-foreground shrink-0">
                    {ex.sets}×{ex.repsMin}–{ex.repsMax}
                  </p>
                  {ex.exercise?.primaryMuscle && (
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: getMuscleColor(ex.exercise.primaryMuscle) }}
                    />
                  )}
                </div>
              ))}
              {todayDay.exercises.length > 4 && (
                <p className="text-[10px] text-muted-foreground pl-5">
                  +{todayDay.exercises.length - 4} esercizi
                </p>
              )}
            </div>

            <Button className="w-full" size="sm" onClick={handleStart} disabled={isLoading}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Inizia Allenamento
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nessun esercizio programmato per oggi.</p>
        )}
      </CardContent>
    </Card>
  );
}
