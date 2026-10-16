import type { SplitType, WorkoutType } from "@prisma/client";

export interface PlanExercise {
  /** Nome inglese dell'esercizio nella libreria di sistema. */
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe?: number;
  restSeconds: number;
  notes?: string;
}

export interface PlanDay {
  name: string;
  workoutType: WorkoutType;
  exercises: PlanExercise[];
}

export interface PlanDefinition {
  name: string;
  description: string;
  frequency: number;
  durationWeeks: number;
  splitType: SplitType;
  days: PlanDay[];
}
