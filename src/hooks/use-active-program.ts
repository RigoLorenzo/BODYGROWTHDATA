"use client";

import { useQuery } from "@tanstack/react-query";
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
      // Anche vuota: nel piano la nota è quella del giorno, non quella dell'ultima volta
      notes: ex.notes ?? "",
    }));

/** Avvia un giorno del piano (o un allenamento libero) */
export function useStartPlanDay() {
  const { startWorkout, isLoading } = useWorkoutSession();

  // Il piano avanza al completamento dell'allenamento, lato server: un
  // allenamento abbandonato non fa saltare il giorno.
  const startDay = (day: PlanDay) =>
    startWorkout(
      { workoutType: day.workoutType, programDayId: day.id, programDayName: day.name },
      toPlanExercises(day)
    );

  const startFree = () => startWorkout({ workoutType: "CUSTOM" });

  return { startDay, startFree, isLoading };
}
