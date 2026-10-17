"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import type { ActiveProgramResponse, PlanDay } from "@/types";

export const ACTIVE_PROGRAM_KEY = ["programs", "active"] as const;

/** Piano attivo con tutti i giorni e il giorno consigliato */
export function useActiveProgram() {
  return useQuery<ActiveProgramResponse | null>({
    queryKey: ACTIVE_PROGRAM_KEY,
    queryFn: async () => {
      const res = await fetch("/api/programs/active");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });
}

const toPlanExercises = (day: PlanDay) =>
  day.exercises
    .filter((ex) => ex.exercise)
    .map((ex) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exercise!.name,
      exerciseNameIt: ex.exercise!.nameIt,
      restSeconds: ex.restSeconds,
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      notes: ex.notes ?? undefined,
    }));

/** Avvia un giorno del piano (o un allenamento libero) e fa avanzare il piano */
export function useStartPlanDay() {
  const queryClient = useQueryClient();
  const { startWorkout, isLoading } = useWorkoutSession();

  const advance = useMutation({
    mutationFn: async (dayIndex: number) => {
      await fetch("/api/programs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", dayIndex }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_PROGRAM_KEY }),
  });

  const startDay = (day: PlanDay, index: number) => {
    startWorkout(
      { workoutType: day.workoutType, programDayId: day.id, programDayName: day.name },
      toPlanExercises(day)
    );
    advance.mutate(index);
  };

  const startFree = () => startWorkout({ workoutType: "CUSTOM" });

  return { startDay, startFree, isLoading };
}
