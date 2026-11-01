import type { ActivitySource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { shownWellnessSource } from "@/lib/devices/source";
import { updateUserStreak } from "@/lib/streak-calculator";
import { DEFAULT_MAX_HR, DEFAULT_RESTING_HR, trimp } from "./load";
import type { BestEffort, RunSplit } from "./track";

/** Dati di una corsa, da qualsiasi fonte */
export interface RunInput {
  source: ActivitySource;
  externalId?: string | null;
  name: string;
  sportType?: string;
  startedAt: Date;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  elevationGain?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  avgCadence?: number | null;
  calories?: number | null;
  polyline?: string | null;
  splits?: RunSplit[] | null;
  bestEfforts?: BestEffort[] | null;
  detailed?: boolean;
  notes?: string | null;
  /** Nome generato (la fonte non ne ha uno): non sostituisce quello scelto nell'app */
  generatedName?: boolean;
}

/** FC a riposo misurata dallo smartwatch: mediana degli ultimi 30 giorni */
async function measuredRestingHr(userId: string): Promise<number | null> {
  const days = await prisma.wellnessDay.findMany({
    where: { userId, source: await shownWellnessSource(userId), restingHr: { not: null } },
    orderBy: { date: "desc" },
    take: 30,
    select: { restingHr: true },
  });
  const values = days.map((d) => d.restingHr!).sort((a, b) => a - b);
  return values.length >= 5 ? values[values.length >> 1] : null;
}

async function heartRateProfile(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { maxHeartRate: true, restingHeartRate: true },
  });
  return {
    max: profile?.maxHeartRate ?? DEFAULT_MAX_HR,
    // Senza valore impostato vale quello dell'orologio
    resting: profile?.restingHeartRate ?? (await measuredRestingHr(userId)) ?? DEFAULT_RESTING_HR,
  };
}

const DUPLICATE_WINDOW_MS = 2 * 60_000;
const SYNCED_SOURCES = new Set<ActivitySource>(["STRAVA", "MI_FITNESS", "GARMIN"]);

/**
 * Nuovo arrivo della stessa corsa dalla stessa fonte: un riepilogo non
 * cancella percorso e parziali già scaricati, e nome e note modificati
 * nell'app restano quando la fonte non li fornisce.
 */
function preserveOnUpdate<T extends Record<string, unknown>>(data: T, input: RunInput, wasDetailed: boolean): Partial<T> {
  const out: Partial<T> = { ...data };
  if (wasDetailed && !input.detailed) {
    for (const key of ["polyline", "splits", "bestEfforts", "detailed"]) delete out[key];
  }
  if (input.notes === undefined) delete out.notes;
  if (input.generatedName) delete out.name;
  return out;
}

const json = (v: unknown) => (v == null ? undefined : (v as Prisma.InputJsonValue));

/**
 * Salva (o aggiorna) una corsa e la sua seduta di allenamento: così conta per
 * streak, calendario e settimana come un allenamento in palestra.
 * Con externalId l'operazione è idempotente (stessa corsa Strava = stessa riga).
 */
export async function saveRun(userId: string, input: RunInput, opts: { updateStreak?: boolean } = {}) {
  const hr = await heartRateProfile(userId);
  const load = trimp(input.movingTime, input.avgHeartRate, hr.max, hr.resting);
  const endedAt = new Date(input.startedAt.getTime() + input.elapsedTime * 1000);

  const runData = {
    name: input.name.slice(0, 200),
    sportType: input.sportType ?? "Run",
    startedAt: input.startedAt,
    distance: input.distance,
    movingTime: input.movingTime,
    elapsedTime: input.elapsedTime,
    elevationGain: input.elevationGain ?? null,
    avgHeartRate: input.avgHeartRate ?? null,
    maxHeartRate: input.maxHeartRate ?? null,
    avgCadence: input.avgCadence ?? null,
    calories: input.calories ?? null,
    polyline: input.polyline ?? null,
    splits: json(input.splits),
    bestEfforts: json(input.bestEfforts),
    detailed: input.detailed ?? false,
    trainingLoad: load,
    notes: input.notes ?? null,
  };
  const sessionData = {
    startedAt: input.startedAt,
    endedAt,
    duration: input.elapsedTime,
    activeSeconds: input.movingTime,
    status: "COMPLETED" as const,
    workoutType: "CARDIO" as const,
  };

  const sameExternal = input.externalId
    ? await prisma.runActivity.findUnique({
        where: { userId_source_externalId: { userId, source: input.source, externalId: input.externalId } },
        select: { id: true, sessionId: true, source: true, detailed: true },
      })
    : null;
  // Stessa corsa da un'altra fonte (es. Strava e file GPX): partenza entro 2 minuti
  const sameStart =
    sameExternal ??
    (await prisma.runActivity.findFirst({
      where: {
        userId,
        startedAt: {
          gte: new Date(input.startedAt.getTime() - DUPLICATE_WINDOW_MS),
          lte: new Date(input.startedAt.getTime() + DUPLICATE_WINDOW_MS),
        },
      },
      select: { id: true, sessionId: true, source: true, detailed: true },
    }));
  const existing = sameStart;
  // Le fonti collegate vincono su GPX e manuale: hanno più dati e si aggiornano
  const takeOver =
    !!existing && !sameExternal && SYNCED_SOURCES.has(input.source) && !SYNCED_SOURCES.has(existing.source);
  if (existing && !sameExternal && !takeOver) {
    return prisma.runActivity.findUniqueOrThrow({ where: { id: existing.id } });
  }

  const run = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.workoutSession.update({ where: { id: existing.sessionId }, data: sessionData });
      return tx.runActivity.update({
        where: { id: existing.id },
        data: takeOver
          ? { ...runData, source: input.source, externalId: input.externalId ?? null }
          : preserveOnUpdate(runData, input, existing.detailed),
      });
    }
    const session = await tx.workoutSession.create({ data: { ...sessionData, userId } });
    return tx.runActivity.create({
      data: { ...runData, userId, sessionId: session.id, source: input.source, externalId: input.externalId ?? null },
    });
  });

  if (opts.updateStreak !== false) await updateUserStreak(userId);
  return run;
}

/** Elimina la corsa insieme alla sua seduta */
export async function deleteRun(userId: string, runId: string): Promise<boolean> {
  const run = await prisma.runActivity.findFirst({ where: { id: runId, userId }, select: { sessionId: true } });
  if (!run) return false;
  await prisma.workoutSession.delete({ where: { id: run.sessionId } });
  await updateUserStreak(userId);
  return true;
}
