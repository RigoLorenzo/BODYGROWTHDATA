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
  thisWeek: { volume: number; workouts: number; gymWorkouts?: number; runs?: number; runDistance?: number };
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
  programDayId?: string;
  programDayName?: string;
}

export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseNameIt?: string | null;
  orderIndex: number;
  restTimerSeconds: number;
  fromPlan?: boolean;
  targetSets?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  /** Note del piano (es. "Forza — RIR 1") */
  notes?: string;
  /** Serie di lavoro dell'ultima volta che hai fatto l'esercizio */
  lastSets?: { weight: number | null; reps: number | null }[];
  /** Data di quelle serie (ISO) */
  lastDate?: string;
  /** true se vengono dall'ultima volta che hai fatto lo stesso giorno del piano */
  lastSameDay?: boolean;
  /** Proposta di oggi: aumento di carico o stessi numeri da battere */
  progression?: { increase: boolean; previousTop: number };
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
  notes?: string | null;
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
  /** Bozza salvata durante l'allenamento (vedi lib/session-draft) */
  draft?: unknown;
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

/** Risposta di GET /api/analytics?type=weekly */
export interface WeeklyAnalytics {
  weeks: {
    weekStart: string;
    label: string;
    /** Volume Load: peso × ripetizioni */
    tonnage: number;
    /** Serie di lavoro totali (escluse le warm-up) */
    workingSets: number;
    sessions: number;
    effectiveSetsByMuscle: Record<string, number>;
    directSetsByMuscle: Record<string, number>;
  }[];
  /** Allenamenti a settimana, sulle settimane in cui ti sei allenato */
  trainingFrequency: number;
  weeklyAverageWorkingSets: number;
}

/** Esercizio di un giorno del piano, completo di tutti i parametri */
export interface ProgramDetailExercise extends Omit<PlanExercise, "exercise"> {
  id: string;
  exercise:
    | (NonNullable<PlanExercise["exercise"]> & { muscleGroups?: string[]; muscleContributions?: unknown })
    | null;
  orderIndex: number;
  restSeconds: number;
  rpe: number | null;
}

/** Risposta di GET /api/programs/[id] */
export interface ProgramDetail {
  id: string;
  name: string;
  description: string | null;
  frequency: number;
  durationWeeks: number;
  splitType: string;
  isActive: boolean;
  days: (Omit<PlanDay, "exercises"> & { exercises: ProgramDetailExercise[] })[];
}
