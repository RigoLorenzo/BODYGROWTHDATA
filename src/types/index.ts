import type { Session, User, WorkoutSession, Exercise, Set, WorkoutExercise, PersonalRecord } from "@prisma/client";

export type { Session, User };

export interface ExtendedUser extends User {
  id: string;
}

export interface WorkoutSessionWithExercises extends WorkoutSession {
  exercises: WorkoutExerciseWithSets[];
  personalRecords?: PersonalRecord[];
  _count?: { personalRecords: number };
}

export interface WorkoutExerciseWithSets extends WorkoutExercise {
  exercise: Pick<Exercise, "id" | "name" | "primaryMuscle" | "category">;
  sets: Set[];
}

export interface ExerciseSearchResult {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  muscleGroups: string[];
  primaryMuscle: string | null;
  equipment: string[];
  difficulty: number;
  isCustom: boolean;
}

export interface AnalyticsOverview {
  thisWeek: { volume: number; workouts: number };
  lastWeek: { volume: number; workouts: number };
  total: { volume: number; workouts: number };
  volumeChange: number;
  streak: number;
  longestStreak: number;
}

export interface HeatmapData {
  [date: string]: {
    volume: number;
    count: number;
    duration: number;
  };
}

export interface ActiveSession {
  id: string;
  startedAt: Date;
  exercises: ActiveExercise[];
}

export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  orderIndex: number;
  restTimerSeconds: number;
  sets: ActiveSet[];
}

export interface ActiveSet {
  id?: string;
  setNumber: number;
  type: "WARMUP" | "WORKING" | "DROPSET" | "FAILURE" | "MYOREP";
  weight?: number;
  reps?: number;
  rpe?: number;
  tempo?: string;
  completed: boolean;
}
