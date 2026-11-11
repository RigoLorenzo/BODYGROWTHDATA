import { z } from "zod/v4";
import { PERIOD_PRESETS } from "../data/periods";
import { ACTIVITY_KINDS, GROUP_BY, TRAINING_METRICS } from "../data/training-query";

/**
 * Input dei tool: uno schema solo, usato sia per descrivere il tool al modello
 * (JSON Schema) sia per validare ogni chiamata prima di eseguirla.
 */

export const MUSCLES = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "FOREARMS",
  "CORE",
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "FULL_BODY",
] as const;

export const EQUIPMENT = [
  "BARBELL",
  "DUMBBELL",
  "MACHINE",
  "CABLE",
  "BODYWEIGHT",
  "KETTLEBELL",
  "BANDS",
  "SMITH_MACHINE",
  "TRAP_BAR",
  "OTHER",
] as const;

const WORKOUT_TYPES = ["PUSH", "PULL", "LEGS", "UPPER", "LOWER", "FULL_BODY", "CARDIO", "CUSTOM"] as const;
const SPLIT_TYPES = ["PPL", "UPPER_LOWER", "BRO_SPLIT", "FULL_BODY", "ARNOLD", "CUSTOM"] as const;

export const emptySchema = z.object({}).strict();

export const getProgramSchema = z
  .object({
    programId: z.string().optional().describe("Id del piano; se assente, il piano attivo"),
  })
  .strict();

export const periodSchema = z
  .object({
    preset: z.enum(PERIOD_PRESETS).describe(
      "this_week/last_week, this_month/last_month (mesi di calendario), this_year/last_year, last_n_weeks/last_n_days (con n), since_start (da quando usa l'app), custom (con from/to)"
    ),
    n: z.number().int().min(1).max(1825).optional().describe("Numero di settimane o giorni per last_n_*"),
    from: z.string().optional().describe("Solo per custom: primo giorno incluso, yyyy-MM-dd"),
    to: z.string().optional().describe("Solo per custom: ultimo giorno incluso, yyyy-MM-dd (default oggi)"),
  })
  .strict();

export const trainingQuerySchema = z
  .object({
    metric: z.enum(TRAINING_METRICS).describe(
      "sessions = numero di allenamenti; sets = serie di lavoro; reps; volume_kg = peso × ripetizioni; training_time = ore; max_weight / e1rm = serie più pesante / massimale stimato (richiedono exerciseIds o groupBy 'exercise'); run_distance, run_time, run_pace"
    ),
    period: periodSchema,
    groupBy: z.enum(GROUP_BY).default("none").describe("Dettaglio: week, month, plan (per piano seguito), exercise, muscle"),
    activity: z.enum(ACTIVITY_KINDS).default("all").describe("gym = palestra, run = corsa, cardio = bici e altre attività importate"),
    muscles: z.array(z.enum(MUSCLES)).max(12).default([]).describe("Filtra per muscoli (serie dirette e indirette)"),
    exerciseIds: z.array(z.string()).max(20).default([]).describe("Filtra per esercizi: gli id vengono da search_exercises o get_program"),
  })
  .strict();

export const exerciseHistorySchema = z
  .object({
    exerciseId: z.string().describe("Id dell'esercizio"),
    lastSessions: z.number().int().min(1).max(20).default(6).describe("Quante sedute recenti mostrare"),
  })
  .strict();

export const recoverySchema = z
  .object({
    days: z.number().int().min(3).max(90).default(14).describe("Giorni da analizzare"),
  })
  .strict();

export const searchExercisesSchema = z
  .object({
    query: z.string().max(80).optional().describe("Nome o parte del nome (italiano o inglese)"),
    muscles: z.array(z.enum(MUSCLES)).max(6).default([]),
    equipment: z.array(z.enum(EQUIPMENT)).max(10).default([]),
    limit: z.number().int().min(1).max(60).default(25),
  })
  .strict();

export const injurySchema = z
  .object({
    area: z.string().max(60).describe("Zona, es. spalla destra, ginocchio, lombare"),
    note: z.string().max(300).optional(),
    avoid: z.array(z.string().max(60)).max(10).default([]).describe("Movimenti da evitare, es. 'spinte sopra la testa'"),
  })
  .strict();

export const briefSchema = z
  .object({
    primaryGoal: z.string().max(120).optional().describe("Obiettivo principale in poche parole"),
    goalDetails: z.string().max(1000).optional(),
    daysPerWeek: z.number().int().min(1).max(7).optional(),
    preferredDays: z.array(z.number().int().min(1).max(7)).max(7).optional().describe("1 = lunedì … 7 = domenica"),
    sessionMinutes: z.number().int().min(15).max(240).optional().describe("Durata disponibile per seduta, in minuti"),
    equipment: z
      .array(z.enum([...EQUIPMENT, "FULL_GYM"]))
      .max(11)
      .optional()
      .describe("Attrezzatura disponibile; FULL_GYM = palestra completa"),
    likedExerciseIds: z.array(z.string()).max(60).optional().describe("Lista COMPLETA aggiornata degli esercizi graditi"),
    dislikedExerciseIds: z.array(z.string()).max(60).optional().describe("Lista COMPLETA aggiornata degli esercizi da evitare"),
    injuries: z.array(injurySchema).max(10).optional().describe("Lista COMPLETA aggiornata; [] = nessun infortunio"),
    notes: z.string().max(2000).optional().describe("Altre informazioni utili, sostituisce le note precedenti"),
  })
  .strict();

export const askUserSchema = z
  .object({
    questions: z
      .array(
        z
          .object({
            id: z.string().max(40).describe("Identificativo breve, es. 'giorni'"),
            question: z.string().max(200),
            options: z.array(z.string().max(60)).max(8).default([]).describe("Risposte rapide da toccare"),
            multiSelect: z.boolean().default(false),
            allowFreeText: z.boolean().default(true),
          })
          .strict()
      )
      .min(1)
      .max(4),
  })
  .strict();

export const proposeProgramSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    durationWeeks: z.number().int().min(1).max(52),
    splitType: z.enum(SPLIT_TYPES),
    rationale: z.string().min(1).max(2000).describe("Perché questo piano, in parole semplici, collegato a obiettivo e dati"),
    days: z
      .array(
        z
          .object({
            name: z.string().min(1).max(100),
            workoutType: z.enum(WORKOUT_TYPES),
            exercises: z
              .array(
                z
                  .object({
                    exerciseId: z.string().describe("Id da search_exercises"),
                    sets: z.number().int().min(1).max(10),
                    repsMin: z.number().int().min(1).max(100),
                    repsMax: z.number().int().min(1).max(100),
                    rpe: z.number().min(5).max(10).optional(),
                    restSeconds: z.number().int().min(15).max(600),
                    notes: z.string().max(300).optional(),
                  })
                  .strict()
              )
              .min(1)
              .max(15),
          })
          .strict()
      )
      .min(1)
      .max(7),
  })
  .strict();

export type TrainingQueryInput = z.infer<typeof trainingQuerySchema>;
export type BriefInput = z.infer<typeof briefSchema>;
export type AskUserInput = z.infer<typeof askUserSchema>;
export type ProposeProgramInput = z.infer<typeof proposeProgramSchema>;

/** JSON Schema da inviare all'API (senza la chiave $schema) */
export function inputSchemaOf(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json as { type: "object"; [key: string]: unknown };
}
