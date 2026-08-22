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
  nameIt?: string | null;
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
  /** Esercizio che stai svolgendo ora (o a cui si riferisce il recupero in corso) */
  currentExerciseId?: string;
  /** Intervalli di recupero cronometrati durante l'allenamento */
  restIntervals: RestInterval[];
  programDayId?: string;
  programDayName?: string;
}

/**
 * Un recupero: parte quando finisci una serie o un esercizio,
 * si chiude quando riprendi. `endedAt` assente = recupero in corso.
 */
export interface RestInterval {
  id: string;
  kind: "SET" | "EXERCISE";
  startedAt: number;
  endedAt?: number;
  /** id locale dell'esercizio appena terminato */
  exerciseId?: string;
  setIndex?: number;
  targetSeconds?: number;
}

export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseNameIt?: string | null;
  orderIndex: number;
  restTimerSeconds: number;
  fromPlan?: boolean;
  /** Momento in cui hai iniziato l'esercizio (assente = non ancora iniziato) */
  startedAt?: number;
  /** Momento in cui hai premuto "Fine esercizio" */
  finishedAt?: number;
  finished?: boolean;
  targetSets?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  sets: ActiveSet[];
}

export interface ActiveSet {
  id?: string;
  setNumber: number;
  /** Valori solo proposti (copiati dalla serie precedente), non ancora inseriti dall'utente */
  prefilled?: boolean;
  type: "WARMUP" | "WORKING" | "DROPSET" | "FAILURE" | "MYOREP";
  weight?: number;
  reps?: number;
  rpe?: number;
  tempo?: string;
  completed: boolean;
}

/** Esercizio programmato in un giorno del piano */
export interface PlanExercise {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds?: number;
  exercise: { id: string; name: string; nameIt?: string | null; primaryMuscle: string | null } | null;
}

/** Giorno del piano di allenamento */
export interface PlanDay {
  id: string;
  name: string;
  dayIndex: number;
  workoutType: string;
  exercises: PlanExercise[];
}

/** Risposta di GET /api/programs/active */
export interface ActiveProgramResponse {
  programId: string;
  currentDay: number;
  totalDays: number;
  weekProgress: number;
  suggestedDayIndex: number;
  program: { name: string; durationWeeks: number; frequency: number };
  days: PlanDay[];
  todayDay: PlanDay | null;
}

/** Allenamento ancora aperto sul server (GET /api/sessions/active) */
export interface ServerActiveSession {
  id: string;
  startedAt: string;
  programDayId: string | null;
  workoutType: string;
  exercises: {
    id: string;
    exerciseId: string;
    orderIndex: number;
    restTimerSeconds: number;
    exercise: { id: string; name: string; nameIt: string | null };
    sets: {
      setNumber: number;
      type: string;
      weight: number | null;
      reps: number | null;
      rpe: number | null;
    }[];
  }[];
}
