import type { GarminConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UnitTimeout, runWellnessPlan, unitDays, type WellnessDriver } from "@/lib/wellness/engine";
import { offsetHour, zoneHour, type HeartSample, type HourOf } from "@/lib/wellness/heart";
import { GARMIN_HEART_TRACK, GARMIN_LIGHT_TRACK, type Unit } from "@/lib/wellness/plan";
import { applySleepHeartRate, saveSleepSession, saveWellnessDays } from "@/lib/wellness/store";
import type { DaySummary } from "@/lib/wellness/types";
import { GarminError, dailyHeartRate, dailySummaries, isGarminAuthError, sleepSummaries, type GarminClient } from "./client";
import { dayOffset, mapDailyHeartRate, mapDailySummary, mapSleep } from "./mapping";

/**
 * Benessere da Garmin (ordine e cursori in lib/wellness/engine):
 * - dati leggeri a blocchi di 28 giorni, due richieste per blocco: riepiloghi
 *   giornalieri (passi, calorie, FC a riposo, stress, SpO₂) e notti;
 * - battiti al minuto un giorno alla volta: media, curva oraria e FC minima
 *   e massima della notte, sull'intera notte anche se inizia il giorno prima
 *   (la Personal API dà solo la media della notte).
 * I giorni arrivano già come date locali: niente fusi da indovinare.
 */

const SOURCE = "GARMIN" as const;
/** Oltre la scadenza un blocco in corso può finire entro questo margine */
const HARD_STOP_MS = 10_000;

interface Ctx {
  userId: string;
  client: GarminClient;
  hardStop: number;
  hourOf: HourOf | null;
  errors: string[];
  /** battiti dei giorni appena scaricati: una notte sta a cavallo di due giorni */
  heartByDate: Map<string, HeartSample[]>;
}

const DAY = 86_400;
const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY * 1000).toISOString().slice(0, 10);

/**
 * Campioni del giorno insieme a quelli dei giorni vicini già scaricati: i
 * blocchi vanno in ordine (avanti o a ritroso), così la notte che inizia la
 * sera prima ha tutti i battiti. Si tengono solo gli ultimi giorni.
 */
function withNeighbours(ctx: Ctx, date: string, samples: HeartSample[]) {
  ctx.heartByDate.set(date, samples);
  for (const key of [...ctx.heartByDate.keys()]) {
    if (Math.abs(Date.parse(key) - Date.parse(date)) > 2 * DAY * 1000) ctx.heartByDate.delete(key);
  }
  return [shiftDate(date, -1), date, shiftDate(date, 1)].flatMap((d) => ctx.heartByDate.get(d) ?? []);
}

/** Un tipo che fallisce non blocca gli altri; tempo, limiti Garmin e chiave scaduta sì */
async function attempt<T>(ctx: Ctx, label: string, read: () => Promise<T>, fallback: T): Promise<T> {
  if (Date.now() > ctx.hardStop) throw new UnitTimeout();
  try {
    return await read();
  } catch (error) {
    if (isGarminAuthError(error)) throw error;
    const message = error instanceof Error ? error.message : "errore";
    ctx.errors.push(`${label}: ${message}`);
    // Garmin ha chiesto di rallentare: si riprende alla prossima sincronizzazione
    if (error instanceof GarminError && error.rateLimited) throw new UnitTimeout();
    console.warn("benessere Garmin", label, error);
    return fallback;
  }
}

async function lightUnit(ctx: Ctx, unit: Unit) {
  const days = unitDays(unit);
  const summaries = await attempt(ctx, "riepiloghi", () => dailySummaries(ctx.client, days.first, days.last), []);
  const sleeps = await attempt(ctx, "sonno", () => sleepSummaries(ctx.client, days.first, days.last), []);
  const mapped = summaries.map(mapDailySummary).filter((d): d is DaySummary => d != null);
  const saved = await saveWellnessDays(ctx.userId, SOURCE, mapped, days.has);
  for (const sleep of sleeps.flatMap(mapSleep)) {
    if (days.has(sleep.date)) await saveSleepSession(ctx.userId, SOURCE, sleep);
  }
  return saved;
}

async function heartUnit(ctx: Ctx, unit: Unit) {
  const days = unitDays(unit);
  let saved = 0;
  for (let i = 0; i < unit.days; i++) {
    const date = new Date((unit.from + i * DAY) * 1000).toISOString().slice(0, 10);
    const day = await attempt(ctx, "battiti", () => dailyHeartRate(ctx.client, date), null);
    if (!day) continue;
    const offset = dayOffset(day);
    const mapped = mapDailyHeartRate(day, ctx.hourOf ?? offsetHour(offset ?? 0));
    if (!mapped) continue;
    saved += await saveWellnessDays(ctx.userId, SOURCE, [mapped.summary], days.has);
    // La Personal API dà solo la FC media della notte: minima e massima dai battiti al minuto
    await applySleepHeartRate(ctx.userId, SOURCE, withNeighbours(ctx, date, mapped.samples));
  }
  return saved;
}

type Coverage = Pick<GarminConnection, "wellnessSyncedFrom" | "wellnessSyncedUntil" | "wellnessHrFrom" | "wellnessHrUntil" | "timeZone">;

/** Recenti prima, poi lo storico finché c'è tempo. Restituisce i giorni salvati */
export async function syncGarminWellness(
  userId: string,
  client: GarminClient,
  conn: Coverage,
  deadline: number,
  opts: { recent?: boolean } = {}
) {
  const ctx: Ctx = {
    userId,
    client,
    hardStop: deadline + HARD_STOP_MS,
    hourOf: conn.timeZone ? zoneHour(conn.timeZone) : null,
    errors: [],
    heartByDate: new Map(),
  };
  const driver: WellnessDriver = {
    userId,
    source: SOURCE,
    light: { track: GARMIN_LIGHT_TRACK, run: (unit) => lightUnit(ctx, unit) },
    heart: { track: GARMIN_HEART_TRACK, run: (unit) => heartUnit(ctx, unit) },
    saveCoverage: (data) => prisma.garminConnection.update({ where: { userId }, data }),
  };
  try {
    return await runWellnessPlan(driver, conn, deadline, opts);
  } finally {
    await prisma.garminConnection.updateMany({
      where: { userId },
      data: { wellnessError: ctx.errors.length ? [...new Set(ctx.errors)].slice(0, 3).join(" · ").slice(0, 500) : null },
    });
  }
}
