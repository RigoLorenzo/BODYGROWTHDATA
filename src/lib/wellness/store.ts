import type { DeviceProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { heartRateBetween, type HeartSample } from "./heart";
import type { DaySummary, SleepInput } from "./types";

/**
 * Salvataggio dei dati benessere, uguale per ogni orologio. Ogni riga porta
 * la fonte: giorni e notti di orologi diversi convivono e la pagina mostra
 * quelli della fonte scelta.
 */

/** Solo i campi misurati: un dato mancante non cancella quello già salvato */
function dayData(summary: DaySummary) {
  const { hrHourly, ...rest } = summary;
  const data: Prisma.WellnessDayUpdateInput = Object.fromEntries(
    Object.entries(rest).filter(([key, v]) => key !== "date" && v != null)
  );
  if (hrHourly?.length) data.hrHourly = hrHourly as unknown as Prisma.InputJsonValue;
  return data;
}

/** Giorni salvati (con almeno un dato) tra quelli che `keep` accetta */
export async function saveWellnessDays(
  userId: string,
  source: DeviceProvider,
  summaries: Iterable<DaySummary>,
  keep: (date: string) => boolean = () => true
) {
  let saved = 0;
  for (const summary of summaries) {
    if (!keep(summary.date)) continue;
    const update = dayData(summary);
    if (!Object.keys(update).length) continue;
    await prisma.wellnessDay.upsert({
      where: { userId_source_date: { userId, source, date: summary.date } },
      update,
      create: {
        ...(update as Prisma.WellnessDayCreateWithoutUserInput),
        source,
        date: summary.date,
        user: { connect: { id: userId } },
      },
    });
    saved++;
  }
  return saved;
}

/** Campi della notte; i valori facoltativi assenti non cancellano quelli già salvati */
function sleepData(sleep: SleepInput) {
  const { date, startAt, endAt, duration, asleep, deep, light, rem, awake, score, isNap, avgHr, minHr, stages } = sleep;
  const { maxHr, respRate, awakeCount } = sleep;
  return {
    date,
    startAt,
    endAt,
    duration,
    asleep,
    deep,
    light,
    rem,
    awake,
    isNap,
    ...(score != null ? { score } : {}),
    ...(avgHr != null ? { avgHr } : {}),
    ...(minHr != null ? { minHr } : {}),
    ...(maxHr != null ? { maxHr } : {}),
    ...(respRate != null ? { respRate } : {}),
    ...(awakeCount != null ? { awakeCount } : {}),
    stages: stages.length ? (stages as unknown as Prisma.InputJsonValue) : undefined,
  };
}

/**
 * Notte salvata una volta sola: la stessa sessione può arrivare da due
 * letture con identificativi diversi, ma inizia allo stesso istante.
 */
export async function saveSleepSession(userId: string, source: DeviceProvider, sleep: SleepInput) {
  const fields = sleepData(sleep);
  const existing = await prisma.sleepSession.findFirst({
    where: { userId, source, OR: [{ externalId: sleep.externalId }, { startAt: sleep.startAt }] },
    select: { id: true },
  });
  if (existing) await prisma.sleepSession.update({ where: { id: existing.id }, data: fields });
  else await prisma.sleepSession.create({ data: { ...fields, userId, source, externalId: sleep.externalId } });
}

/** FC media e minima delle notti senza, dai battiti al minuto dei giorni `from`-`to` */
export async function fillSleepHeartRate(
  userId: string,
  source: DeviceProvider,
  range: { from: string; to: string },
  samples: HeartSample[]
) {
  if (!samples.length) return;
  const nights = await prisma.sleepSession.findMany({
    where: { userId, source, date: { gte: range.from, lte: range.to }, OR: [{ avgHr: null }, { minHr: null }] },
    select: { id: true, startAt: true, endAt: true, avgHr: true, minHr: true },
  });
  for (const night of nights) {
    const hr = heartRateBetween(samples, night.startAt.getTime() / 1000, night.endAt.getTime() / 1000);
    if (!hr) continue;
    await prisma.sleepSession.update({
      where: { id: night.id },
      data: { avgHr: night.avgHr ?? hr.avgHr, minHr: night.minHr ?? hr.minHr },
    });
  }
}

/** Primo giorno con dati salvati (yyyy-MM-dd) */
export async function firstWellnessDay(userId: string, source: DeviceProvider) {
  const first = await prisma.wellnessDay.findFirst({
    where: { userId, source },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return first?.date ?? null;
}

/** C'è almeno un giorno salvato in [from, to) (yyyy-MM-dd)? */
export async function hasWellnessDays(userId: string, source: DeviceProvider, from: string, to: string) {
  const found = await prisma.wellnessDay.findFirst({
    where: { userId, source, date: { gte: from, lt: to } },
    select: { id: true },
  });
  return !!found;
}
