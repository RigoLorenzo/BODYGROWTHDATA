import { z } from "zod";

export const WORKOUT_TYPES = ["PUSH", "PULL", "LEGS", "UPPER", "LOWER", "FULL_BODY", "CARDIO", "CUSTOM"] as const;
export const SPLIT_TYPES = ["PPL", "UPPER_LOWER", "BRO_SPLIT", "FULL_BODY", "ARNOLD", "CUSTOM"] as const;

export const programExerciseSchema = z
  .object({
    exerciseId: z.string().min(1),
    sets: z.number().int().min(1).max(20).default(3),
    repsMin: z.number().int().min(1).max(100).default(8),
    repsMax: z.number().int().min(1).max(100).default(12),
    rpe: z.number().min(1).max(10).nullish(),
    restSeconds: z.number().int().min(0).max(600).default(90),
    notes: z.string().trim().max(300).nullish(),
  })
  .refine((ex) => ex.repsMax >= ex.repsMin, { message: "repsMax deve essere ≥ repsMin", path: ["repsMax"] });

export const programDaySchema = z.object({
  /** Giorno esistente da aggiornare; assente = giorno nuovo */
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  workoutType: z.enum(WORKOUT_TYPES).default("CUSTOM"),
  exercises: z.array(programExerciseSchema).max(30).default([]),
});

/** Piano completo: usato sia in creazione sia in modifica */
export const programInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullish(),
  frequency: z.number().int().min(1).max(7).default(3),
  durationWeeks: z.number().int().min(1).max(52).default(8),
  splitType: z.enum(SPLIT_TYPES).default("CUSTOM"),
  days: z.array(programDaySchema).max(14).default([]),
});

export type ProgramInput = z.infer<typeof programInputSchema>;
export type ProgramDayInput = z.infer<typeof programDaySchema>;
