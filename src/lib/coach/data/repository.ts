import { prisma } from "@/lib/prisma";
import { buildPlanBlocks, UNKNOWN_PLAN_ID, type PlanBlock, type SessionPlanRef } from "./plan-blocks";
import type { SessionData } from "./training-query";

/**
 * Lettura dei dati del Coach: sempre e solo dell'utente della sessione.
 * Le sedute contate sono quelle completate (palestra, corsa, attività importate).
 */

const COMPLETED = { status: "COMPLETED" as const };

/** Prima seduta mai registrata: le medie non contano le settimane prima */
export async function firstActivity(userId: string): Promise<Date | null> {
  const first = await prisma.workoutSession.findFirst({
    where: { userId, ...COMPLETED },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  return first?.startedAt ?? null;
}

/** Blocchi di allenamento ricavati da tutte le sedute da piano + piano attivo */
export async function loadPlanBlocks(userId: string): Promise<PlanBlock[]> {
  const [sessions, active] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, ...COMPLETED },
      select: { startedAt: true, programDayId: true },
      orderBy: { startedAt: "asc" },
    }),
    prisma.activeProgram.findUnique({
      where: { userId },
      select: { startedAt: true, program: { select: { id: true, name: true } } },
    }),
  ]);

  const dayIds = Array.from(new Set(sessions.map((s) => s.programDayId).filter((id): id is string => !!id)));
  const days = dayIds.length
    ? await prisma.programDay.findMany({
        where: { id: { in: dayIds } },
        select: { id: true, program: { select: { id: true, name: true, creatorId: true } } },
      })
    : [];
  // Solo piani dell'utente: un id di giorno estraneo non deve far trapelare nomi
  const dayToProgram = new Map(days.filter((d) => d.program.creatorId === userId).map((d) => [d.id, d.program]));

  const refs: SessionPlanRef[] = sessions.map((s) => {
    if (!s.programDayId) return { startedAt: s.startedAt, programId: null, programName: null };
    const program = dayToProgram.get(s.programDayId);
    return program
      ? { startedAt: s.startedAt, programId: program.id, programName: program.name }
      : { startedAt: s.startedAt, programId: UNKNOWN_PLAN_ID, programName: null };
  });

  return buildPlanBlocks(
    refs,
    active ? { programId: active.program.id, name: active.program.name, startedAt: active.startedAt } : null
  );
}

/** Sedute complete (esercizi, serie, corsa) nell'intervallo [from, to) */
export async function loadSessions(userId: string, from: Date, to: Date): Promise<SessionData[]> {
  const rows = await prisma.workoutSession.findMany({
    where: { userId, ...COMPLETED, startedAt: { gte: from, lt: to } },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      duration: true,
      workoutType: true,
      sportType: true,
      distance: true,
      run: { select: { distance: true, movingTime: true, elapsedTime: true } },
      exercises: {
        orderBy: { orderIndex: "asc" },
        select: {
          exerciseId: true,
          exercise: {
            select: { name: true, nameIt: true, primaryMuscle: true, muscleGroups: true, muscleContributions: true },
          },
          sets: { select: { type: true, weight: true, reps: true, rpe: true } },
        },
      },
    },
  });

  return rows.map((s) => {
    const wall = s.endedAt ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000) : 0;
    return {
      id: s.id,
      startedAt: s.startedAt,
      // Stessa regola della sezione Fitness (api/analytics/activity)
      kind: s.run ? "run" : s.workoutType === "CARDIO" && s.sportType ? "cardio" : "gym",
      duration: s.run?.elapsedTime ?? s.duration ?? wall,
      run: s.run ? { distance: s.run.distance, movingTime: s.run.movingTime } : null,
      distance: s.distance ?? 0,
      exercises: s.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.exercise.nameIt ?? e.exercise.name,
        primaryMuscle: e.exercise.primaryMuscle,
        muscleGroups: e.exercise.muscleGroups,
        muscleContributions: e.exercise.muscleContributions,
        sets: e.sets,
      })),
    };
  });
}

/** Esercizi utilizzabili dall'utente: libreria + i suoi personalizzati */
export async function searchExercises(
  userId: string,
  filters: { query?: string | null; muscles?: string[]; equipment?: string[]; limit?: number }
) {
  const query = filters.query?.trim();
  const rows = await prisma.exercise.findMany({
    where: {
      AND: [
        { OR: [{ isPublic: true }, { createdById: userId }, { isCustom: false }] },
        query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { nameIt: { contains: query, mode: "insensitive" } },
                { aliases: { has: query.toLowerCase() } },
              ],
            }
          : {},
        filters.muscles?.length ? { muscleGroups: { hasSome: filters.muscles as never[] } } : {},
        filters.equipment?.length ? { equipment: { hasSome: filters.equipment as never[] } } : {},
      ],
    },
    select: {
      id: true,
      name: true,
      nameIt: true,
      primaryMuscle: true,
      muscleGroups: true,
      equipment: true,
      category: true,
      difficulty: true,
      isCustom: true,
    },
    orderBy: [{ difficulty: "asc" }, { name: "asc" }],
    take: 200,
  });
  const limit = Math.min(filters.limit ?? 25, 60);
  return query ? rankByName(rows, query).slice(0, limit) : rows.slice(0, limit);
}

/** Più pertinenti prima: nome uguale, poi che inizia con la ricerca, poi che la contiene */
export function rankByName<T extends { name: string; nameIt: string | null }>(rows: T[], query: string): T[] {
  const q = query.toLowerCase();
  const score = (row: T) =>
    Math.max(
      ...[row.nameIt, row.name].map((raw) => {
        const name = (raw ?? "").toLowerCase();
        if (!name) return 0;
        if (name === q) return 4;
        if (name.startsWith(q)) return 3;
        if (name.split(/\s+/).some((word) => word.startsWith(q))) return 2;
        return name.includes(q) ? 1 : 0;
      })
    );
  return rows
    .map((row, index) => ({ row, index, score: score(row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.row);
}
