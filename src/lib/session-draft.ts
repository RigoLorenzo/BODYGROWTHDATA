import { z } from "zod";
import type { ActiveSession } from "@/types";

const num = z.number().finite();

const draftSetSchema = z.object({
  setNumber: z.number().int().min(1).max(50),
  type: z.enum(["WARMUP", "WORKING", "DROPSET", "FAILURE", "MYOREP"]),
  weight: num.min(0).max(1000).nullish(),
  reps: z.number().int().min(0).max(1000).nullish(),
  rpe: num.min(1).max(10).nullish(),
  completed: z.boolean(),
  prefilled: z.boolean().optional(),
});

const draftExerciseSchema = z.object({
  id: z.string().max(120),
  exerciseId: z.string().max(60),
  exerciseName: z.string().max(200),
  exerciseNameIt: z.string().max(200).nullish(),
  orderIndex: z.number().int().min(0).max(100),
  restTimerSeconds: z.number().int().min(0).max(3600),
  fromPlan: z.boolean().optional(),
  targetSets: z.number().int().optional(),
  targetRepsMin: z.number().int().optional(),
  targetRepsMax: z.number().int().optional(),
  notes: z.string().max(300).optional(),
  lastSets: z.array(z.object({ weight: num.nullable(), reps: num.nullable() })).max(30).optional(),
  progression: z.object({ increase: z.boolean(), previousTop: num }).optional(),
  sets: z.array(draftSetSchema).max(30),
});

/** Bozza dell'allenamento in corso, salvata sul server mentre ti alleni */
export const sessionDraftSchema = z.object({
  programDayName: z.string().max(200).optional(),
  exercises: z.array(draftExerciseSchema).max(40),
});

export type SessionDraft = z.infer<typeof sessionDraftSchema>;

export const draftFromSession = (session: ActiveSession): SessionDraft => ({
  programDayName: session.programDayName,
  exercises: session.exercises.map((ex) => ({
    ...ex,
    sets: ex.sets.map(({ setNumber, type, weight, reps, rpe, completed, prefilled }) => ({
      setNumber,
      type,
      weight,
      reps,
      rpe,
      completed,
      prefilled,
    })),
  })),
});

/** Ricostruisce la sessione dalla bozza; null se la bozza non è valida */
export function sessionFromDraft(
  base: { id: string; startedAt: string | Date; programDayId: string | null },
  draft: unknown
): ActiveSession | null {
  const parsed = sessionDraftSchema.safeParse(draft);
  if (!parsed.success) return null;
  return {
    id: base.id,
    startedAt: new Date(base.startedAt),
    programDayId: base.programDayId ?? undefined,
    programDayName: parsed.data.programDayName,
    exercises: parsed.data.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        weight: s.weight ?? undefined,
        reps: s.reps ?? undefined,
        rpe: s.rpe ?? undefined,
      })),
    })),
  };
}
