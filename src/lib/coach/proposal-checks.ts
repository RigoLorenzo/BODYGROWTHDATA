import type { AthleteBrief } from "@prisma/client";
import { programInputSchema, type ProgramInput } from "@/lib/program-schema";
import { getEquipmentLabel, getMuscleLabel } from "@/lib/utils";
import type { ProposeProgramInput } from "./tools/schemas";

/**
 * Controlli in codice sui piani proposti dal Coach: esercizi esistenti,
 * preferenze, attrezzatura, giorni e durata. Funzioni pure, testate.
 */

export interface ExerciseMeta {
  id: string;
  name: string;
  primaryMuscle: string | null;
  muscleGroups: string[];
  equipment: string[];
}

type BriefLike = Pick<
  AthleteBrief,
  "primaryGoal" | "daysPerWeek" | "sessionMinutes" | "equipment" | "dislikedExerciseIds" | "injuries"
> | null;

/** Informazioni indispensabili prima di proporre un piano */
export function missingBriefSlots(brief: BriefLike): string[] {
  const missing: string[] = [];
  if (!brief?.primaryGoal) missing.push("obiettivo principale (primaryGoal)");
  if (!brief?.daysPerWeek) missing.push("giorni di allenamento a settimana (daysPerWeek)");
  if (!brief?.sessionMinutes) missing.push("durata disponibile per seduta (sessionMinutes)");
  if (!brief?.equipment?.length) missing.push("attrezzatura disponibile (equipment)");
  if (brief?.injuries == null) missing.push("infortuni o fastidi, anche 'nessuno' (injuries: [])");
  return missing;
}

/** Minuti stimati di una seduta: serie × (ripetizioni + recupero) + riscaldamento */
export function estimateDayMinutes(exercises: ProposeProgramInput["days"][number]["exercises"]): number {
  const seconds = exercises.reduce((total, ex) => {
    const avgReps = (ex.repsMin + ex.repsMax) / 2;
    return total + ex.sets * (avgReps * 4 + ex.restSeconds) + 60;
  }, 0);
  return Math.round(seconds / 60 + 8);
}

const MAJOR_MUSCLES = ["CHEST", "BACK", "SHOULDERS", "QUADS", "HAMSTRINGS", "GLUTES"];

export function checkProposal(
  input: ProposeProgramInput,
  brief: BriefLike,
  exercises: Map<string, ExerciseMeta>,
  trainingStyle: string | null
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const disliked = new Set(brief?.dislikedExerciseIds ?? []);
  const equipment = new Set(brief?.equipment ?? []);
  const fullGym = equipment.has("FULL_GYM");
  const weeklySets: Record<string, number> = {};

  if (brief?.daysPerWeek && input.days.length !== brief.daysPerWeek) {
    errors.push(`Il piano ha ${input.days.length} giorni ma l'utente si allena ${brief.daysPerWeek} giorni a settimana.`);
  }

  for (const day of input.days) {
    for (const ex of day.exercises) {
      const meta = exercises.get(ex.exerciseId);
      if (!meta) {
        errors.push(`Esercizio inesistente o non disponibile: ${ex.exerciseId}. Usa gli id di search_exercises.`);
        continue;
      }
      if (ex.repsMax < ex.repsMin) errors.push(`${meta.name}: repsMax deve essere ≥ repsMin.`);
      if (disliked.has(ex.exerciseId)) errors.push(`${meta.name} è tra gli esercizi che l'utente vuole evitare.`);
      const needs = meta.equipment.filter((e) => e !== "BODYWEIGHT" && e !== "OTHER");
      if (!fullGym && equipment.size > 0 && needs.length > 0 && !needs.some((e) => equipment.has(e))) {
        errors.push(`${meta.name} richiede ${needs.map(getEquipmentLabel).join(", ")}, attrezzatura che l'utente non ha.`);
      }
      if (meta.primaryMuscle) weeklySets[meta.primaryMuscle] = (weeklySets[meta.primaryMuscle] ?? 0) + ex.sets;
    }

    const minutes = estimateDayMinutes(day.exercises);
    if (brief?.sessionMinutes && minutes > brief.sessionMinutes + 10) {
      warnings.push(`"${day.name}" dura circa ${minutes} minuti, oltre i ${brief.sessionMinutes} disponibili.`);
    }
  }

  for (const [muscle, sets] of Object.entries(weeklySets)) {
    if (sets > 25) warnings.push(`${getMuscleLabel(muscle)}: ${sets} serie dirette a settimana, molte per la maggior parte delle persone.`);
  }
  if (trainingStyle !== "RUNNING") {
    const missing = MAJOR_MUSCLES.filter((m) => !weeklySets[m]);
    if (missing.length > 0) warnings.push(`Nessuna serie diretta per: ${missing.map(getMuscleLabel).join(", ")}. Va bene solo se è voluto.`);
  }

  return { errors, warnings };
}

/** Converte la proposta nel formato dei piani dell'app */
export function toProgramInput(input: ProposeProgramInput): ProgramInput {
  return programInputSchema.parse({
    name: input.name,
    description: input.description ?? null,
    frequency: input.days.length,
    durationWeeks: input.durationWeeks,
    splitType: input.splitType,
    days: input.days.map((day) => ({
      name: day.name,
      workoutType: day.workoutType,
      exercises: day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        rpe: ex.rpe ?? null,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? null,
      })),
    })),
  });
}
