import type { ActivitySource, MuscleGroup } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exerciseLibrary } from "@/lib/exercise-library";
import { libraryIndex, matchGarminExercise, setsFromSummary, type Muscle } from "./exercise-match";

/**
 * Attività importate dagli smartwatch che non sono corse: palestra (con gli
 * esercizi, se l'orologio li registra), bici, camminate, nuoto… Diventano
 * sedute completate come quelle fatte nell'app: contano per streak,
 * calendario e statistiche. Le corse restano in RunActivity.
 */

export interface ExternalExerciseSummary {
  /** codici dell'orologio (Garmin: BENCH_PRESS / BARBELL_BENCH_PRESS) */
  category: string | null;
  subCategory: string | null;
  sets: number;
  reps: number;
  /** kg × ripetizioni, sommato sulle serie */
  volumeKg: number;
  maxWeightKg: number | null;
}

export interface ExternalWorkoutInput {
  source: ActivitySource;
  externalId: string;
  kind: "strength" | "cardio";
  title: string;
  /** Strength, Ride, Walk, Swim… */
  sportType: string;
  startedAt: Date;
  /** secondi */
  duration: number;
  distance?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  calories?: number | null;
  exercises?: ExternalExerciseSummary[];
}

export type SaveOutcome = "created" | "updated" | "duplicate";

/** Due sedute sono la stessa se si sovrappongono per almeno metà della più corta */
const DUPLICATE_OVERLAP = 0.5;
const library = libraryIndex(exerciseLibrary);

/** Esercizio della libreria o personalizzato dell'utente (creato se manca) */
async function resolveExercise(userId: string, summary: ExternalExerciseSummary, cache: Map<string, string>) {
  const match = matchGarminExercise(library, summary.category, summary.subCategory);
  const key = match.libraryName ? `lib:${match.libraryName}` : `custom:${match.customName}`;
  const cached = cache.get(key);
  if (cached) return { id: cached, match };

  let id: string | null = null;
  if (match.libraryName) {
    id = (await prisma.exercise.findFirst({ where: { name: match.libraryName, isCustom: false }, select: { id: true } }))?.id ?? null;
  }
  if (!id) {
    const name = match.libraryName ?? match.customName;
    const existing = await prisma.exercise.findFirst({ where: { name, isCustom: true, createdById: userId }, select: { id: true } });
    id =
      existing?.id ??
      (
        await prisma.exercise.create({
          data: {
            name,
            primaryMuscle: match.muscle as MuscleGroup,
            muscleGroups: [match.muscle as MuscleGroup],
            category: "COMPOUND",
            isCustom: true,
            isPublic: false,
            createdById: userId,
          },
          select: { id: true },
        })
      ).id;
  }
  cache.set(key, id);
  return { id, match };
}

const sourceLabel = (source: ActivitySource) => (source === "GARMIN" ? "Garmin" : source === "MI_FITNESS" ? "Mi Fitness" : "smartwatch");

/** Esercizi e serie della seduta di palestra, ricostruiti dai totali dell'orologio */
async function writeExercises(userId: string, sessionId: string, input: ExternalWorkoutInput) {
  await prisma.workoutExercise.deleteMany({ where: { sessionId } });
  const cache = new Map<string, string>();
  const muscles = new Set<Muscle>();
  let order = 0;
  for (const summary of input.exercises ?? []) {
    if (summary.sets <= 0) continue;
    const { id, match } = await resolveExercise(userId, summary, cache);
    muscles.add(match.muscle);
    const notes = [
      match.sourceName && `${sourceLabel(input.source)}: ${match.sourceName}`,
      summary.maxWeightKg ? `carico massimo ${Math.round(summary.maxWeightKg * 10) / 10} kg` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const sets = setsFromSummary({ sets: summary.sets, reps: summary.reps, volumeKg: summary.volumeKg });
    await prisma.workoutExercise.create({
      data: {
        sessionId,
        exerciseId: id,
        orderIndex: order++,
        notes: notes || null,
        sets: {
          create: sets.map((set, i) => ({
            setNumber: i + 1,
            type: "WORKING",
            reps: set.reps,
            weight: set.weight,
            volume: (set.weight ?? 0) * (set.reps ?? 0),
          })),
        },
      },
    });
  }
  return [...muscles] as MuscleGroup[];
}

/**
 * C'è già una seduta (fatta nell'app, una corsa o da un'altra fonte) per lo
 * stesso momento? Si chiede solo per attività non ancora importate.
 */
async function overlapsExisting(userId: string, input: ExternalWorkoutInput, start: Date, end: Date) {
  const candidates = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "COMPLETED",
      startedAt: { lt: end },
    },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { startedAt: true, endedAt: true, duration: true },
  });
  const length = end.getTime() - start.getTime();
  return candidates.some((c) => {
    const cEnd = c.endedAt ?? new Date(c.startedAt.getTime() + (c.duration ?? 0) * 1000);
    const overlap = Math.min(end.getTime(), cEnd.getTime()) - Math.max(start.getTime(), c.startedAt.getTime());
    const shorter = Math.min(length, cEnd.getTime() - c.startedAt.getTime());
    return shorter > 0 && overlap >= shorter * DUPLICATE_OVERLAP;
  });
}

/**
 * Salva (o aggiorna) un'attività importata. Se nello stesso momento c'è già
 * una seduta registrata nell'app non si duplica: quella dell'app ha più dati.
 */
export async function saveExternalWorkout(userId: string, input: ExternalWorkoutInput): Promise<SaveOutcome> {
  const start = input.startedAt;
  const end = new Date(start.getTime() + Math.max(60, input.duration) * 1000);
  const existing = await prisma.workoutSession.findUnique({
    where: { userId_source_externalId: { userId, source: input.source, externalId: input.externalId } },
    select: { id: true },
  });
  if (!existing && (await overlapsExisting(userId, input, start, end))) return "duplicate";

  const totals = (input.exercises ?? []).reduce(
    (t, e) => ({ volume: t.volume + e.volumeKg, sets: t.sets + e.sets, reps: t.reps + e.reps }),
    { volume: 0, sets: 0, reps: 0 }
  );
  const data = {
    startedAt: start,
    endedAt: end,
    duration: Math.round(input.duration),
    activeSeconds: Math.round(input.duration),
    status: "COMPLETED" as const,
    workoutType: input.kind === "strength" ? ("CUSTOM" as const) : ("CARDIO" as const),
    title: input.title.slice(0, 200),
    sportType: input.sportType,
    distance: input.distance ?? null,
    avgHeartRate: input.avgHeartRate ?? null,
    maxHeartRate: input.maxHeartRate ?? null,
    estimatedCalories: input.calories != null ? Math.round(input.calories) : null,
    totalVolume: Math.round(totals.volume),
    totalSets: totals.sets,
    totalReps: totals.reps,
  };

  const session = existing
    ? await prisma.workoutSession.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.workoutSession.create({
        data: { ...data, userId, source: input.source, externalId: input.externalId },
        select: { id: true },
      });

  if (input.kind === "strength" && input.exercises?.length) {
    const muscles = await writeExercises(userId, session.id, input);
    await prisma.workoutSession.update({ where: { id: session.id }, data: { muscleGroupsTargeted: muscles } });
  }
  return existing ? "updated" : "created";
}

/** L'attività è stata cancellata sull'orologio */
export async function deleteExternalWorkout(userId: string, source: ActivitySource, externalId: string) {
  await prisma.workoutSession.deleteMany({ where: { userId, source, externalId } });
}
