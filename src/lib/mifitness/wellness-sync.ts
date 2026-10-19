import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DaySummary, SleepInput } from "@/lib/wellness/types";
import { MiFitnessError, listFitnessData, type FitnessKey, type FitnessRecord, type XiaomiSession } from "./client";
import { heartRateBetween, heartRateSamples, mapSleepRecord, summarizeDays, zoneOffsetSeconds } from "./wellness-mapping";
import {
  HEART_TRACK,
  LIGHT_TRACK,
  backwardUnits,
  forwardUnits,
  isoDay,
  toEpoch,
  utcMidnight,
  type Coverage,
  type Track,
  type Unit,
} from "./wellness-plan";

/**
 * Benessere dall'orologio in blocchi piccoli e indipendenti, ognuno salvato
 * appena scaricato:
 * - dati "leggeri" (sonno, FC a riposo, passi, calorie, SpO2, stress) a
 *   blocchi di 10 giorni, storico di 90;
 * - battiti al minuto (migliaia al giorno) un giorno alla volta, storico di 30.
 * Prima i giorni recenti, poi lo storico a ritroso; un blocco interrotto per
 * tempo si rifà alla sincronizzazione successiva senza perdere gli altri.
 */

const DAY = 86_400;
/** Senza fuso noto si scarica con margine per coprire i giorni locali interi */
const ZONE_PAD = 14 * 3600;
/** I battiti partono dalla sera prima: servono per la FC della notte */
const NIGHT_LEAD = 8 * 3600;
const MAX_PAGES = 300;
/** Oltre la scadenza un blocco in corso può finire entro questo margine */
const HARD_STOP_MS = 10_000;

const LIGHT_KEYS: FitnessKey[] = ["resting_heart_rate", "sleep", "steps", "calories", "spo2", "stress"];

class UnitTimeout extends Error {}

interface Ctx {
  userId: string;
  session: XiaomiSession;
  region: string;
  hardStop: number;
  /** fuso dell'orologio in secondi, se già visto */
  offset: number | null;
  errors: string[];
}

/** Istanti reali del blocco di giorni locali */
function unitRange(ctx: Ctx, unit: Unit) {
  const end = unit.from + unit.days * DAY;
  return ctx.offset == null
    ? { start: unit.from - ZONE_PAD, end: end + ZONE_PAD }
    : { start: unit.from - ctx.offset, end: end - ctx.offset };
}

async function fetchKey(ctx: Ctx, key: FitnessKey, startTime: number, endTime: number) {
  const records: FitnessRecord[] = [];
  let nextKey: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() > ctx.hardStop) throw new UnitTimeout();
    const result = await listFitnessData(ctx.session, ctx.region, { key, startTime, endTime, nextKey });
    records.push(...result.records);
    if (!result.hasMore || !result.nextKey || seen.has(result.nextKey)) break;
    seen.add(result.nextKey);
    nextKey = result.nextKey;
  }
  return records;
}

/** Un tipo che fallisce non blocca gli altri; tempo scaduto e token scaduto sì */
async function tryFetch(ctx: Ctx, key: FitnessKey, startTime: number, endTime: number) {
  try {
    return await fetchKey(ctx, key, startTime, endTime);
  } catch (error) {
    if (error instanceof UnitTimeout || (error instanceof MiFitnessError && error.auth)) throw error;
    console.warn("benessere Mi Fitness", key, error);
    ctx.errors.push(`${key}: ${error instanceof Error ? error.message : "errore"}`);
    return [];
  }
}

/** Il fuso arriva con i dati: dalle volte successive i giorni si scaricano esatti */
function learnOffset(ctx: Ctx, records: FitnessRecord[]) {
  const last = [...records].reverse().find((r) => typeof r.zone_offset === "number");
  if (last) ctx.offset = zoneOffsetSeconds(last);
}

const inUnit = (unit: Unit) => {
  const first = isoDay(unit.from);
  const last = isoDay(unit.from + (unit.days - 1) * DAY);
  return (date: string) => date >= first && date <= last;
};

/** Solo i campi misurati: un dato mancante non cancella quello già salvato */
function dayData(summary: DaySummary) {
  const { hrHourly, ...rest } = summary;
  const data: Prisma.WellnessDayUpdateInput = Object.fromEntries(
    Object.entries(rest).filter(([key, v]) => key !== "date" && v != null)
  );
  if (hrHourly?.length) data.hrHourly = hrHourly as unknown as Prisma.InputJsonValue;
  return data;
}

async function saveDays(userId: string, summaries: Iterable<DaySummary>, keep: (date: string) => boolean) {
  let saved = 0;
  for (const summary of summaries) {
    if (!keep(summary.date)) continue;
    const update = dayData(summary);
    if (!Object.keys(update).length) continue;
    await prisma.wellnessDay.upsert({
      where: { userId_date: { userId, date: summary.date } },
      update,
      create: { ...(update as Prisma.WellnessDayCreateWithoutUserInput), date: summary.date, user: { connect: { id: userId } } },
    });
    saved++;
  }
  return saved;
}

/** Campi della notte; la FC assente non cancella quella ricavata dai battiti */
function sleepData(sleep: SleepInput) {
  const { date, startAt, endAt, duration, asleep, deep, light, rem, awake, score, isNap, avgHr, minHr, stages } = sleep;
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
    score,
    isNap,
    ...(avgHr != null ? { avgHr } : {}),
    ...(minHr != null ? { minHr } : {}),
    stages: stages.length ? (stages as unknown as Prisma.InputJsonValue) : undefined,
  };
}

/** Sonno, FC a riposo, passi, calorie, SpO2 e stress di un blocco di giorni */
async function lightUnit(ctx: Ctx, unit: Unit) {
  const { start, end } = unitRange(ctx, unit);
  const data: Partial<Record<FitnessKey, FitnessRecord[]>> = {};
  for (const key of LIGHT_KEYS) data[key] = await tryFetch(ctx, key, start, end);
  learnOffset(ctx, Object.values(data).flat());

  const keep = inUnit(unit);
  const saved = await saveDays(ctx.userId, summarizeDays(data).values(), keep);
  for (const record of data.sleep ?? []) {
    const sleep = mapSleepRecord(record);
    if (!sleep || !keep(sleep.date)) continue;
    const fields = sleepData(sleep);
    await prisma.sleepSession.upsert({
      where: { userId_externalId: { userId: ctx.userId, externalId: sleep.externalId } },
      update: fields,
      create: { ...fields, userId: ctx.userId, externalId: sleep.externalId },
    });
  }
  return saved;
}

/** Battiti al minuto di un giorno: media, minimo, massimo, curva oraria e FC della notte */
async function heartUnit(ctx: Ctx, unit: Unit) {
  const { start, end } = unitRange(ctx, unit);
  const records = await tryFetch(ctx, "heart_rate", start - NIGHT_LEAD, end);
  learnOffset(ctx, records);
  const keep = inUnit(unit);
  const saved = await saveDays(ctx.userId, summarizeDays({ heart_rate: records }).values(), keep);

  const samples = heartRateSamples(records);
  const nights = await prisma.sleepSession.findMany({
    where: {
      userId: ctx.userId,
      date: { gte: isoDay(unit.from), lte: isoDay(unit.from + (unit.days - 1) * DAY) },
      OR: [{ avgHr: null }, { minHr: null }],
    },
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
  return saved;
}

type CoverageFields = { from: "wellnessSyncedFrom" | "wellnessHrFrom"; until: "wellnessSyncedUntil" | "wellnessHrUntil" };
const LIGHT_FIELDS: CoverageFields = { from: "wellnessSyncedFrom", until: "wellnessSyncedUntil" };
const HEART_FIELDS: CoverageFields = { from: "wellnessHrFrom", until: "wellnessHrUntil" };

async function runForward(ctx: Ctx, cov: Coverage, track: Track, fields: CoverageFields, run: typeof lightUnit, deadline: number) {
  const today = utcMidnight(Date.now() / 1000);
  let saved = 0;
  for (const unit of forwardUnits(cov, track, today)) {
    if (Date.now() > deadline) break;
    saved += await run(ctx, unit);
    // Oggi è parziale: il cursore resta all'inizio di oggi
    cov.until = Math.min(unit.from + unit.days * DAY, today);
    cov.from ??= unit.from;
    await prisma.miFitnessConnection.update({
      where: { userId: ctx.userId },
      data: { [fields.until]: new Date(cov.until * 1000), [fields.from]: new Date(cov.from * 1000) },
    });
  }
  return saved;
}

async function runBackward(ctx: Ctx, cov: Coverage, track: Track, fields: CoverageFields, run: typeof lightUnit, deadline: number) {
  const today = utcMidnight(Date.now() / 1000);
  let saved = 0;
  for (const unit of backwardUnits(cov, track, today)) {
    if (Date.now() > deadline) break;
    saved += await run(ctx, unit);
    cov.from = unit.from;
    await prisma.miFitnessConnection.update({
      where: { userId: ctx.userId },
      data: { [fields.from]: new Date(cov.from * 1000) },
    });
  }
  return saved;
}

/**
 * Recenti prima (leggeri, poi battiti), poi lo storico (leggeri, poi
 * battiti) finché c'è tempo. Restituisce i giorni salvati.
 * `recent: false` (passi dedicati allo storico) salta i giorni recenti, già
 * aggiornati dalla sincronizzazione normale: altrimenti ogni passo li
 * rifarebbe e con un cloud lento lo storico non avanzerebbe mai.
 */
export async function syncWellness(
  userId: string,
  session: XiaomiSession,
  region: string,
  deadline: number,
  opts: { recent?: boolean } = {}
) {
  const conn = await prisma.miFitnessConnection.findUnique({
    where: { userId },
    select: {
      wellnessSyncedFrom: true,
      wellnessSyncedUntil: true,
      wellnessHrFrom: true,
      wellnessHrUntil: true,
      wellnessZoneOffset: true,
    },
  });
  if (!conn) return 0;

  const ctx: Ctx = { userId, session, region, hardStop: deadline + HARD_STOP_MS, offset: conn.wellnessZoneOffset, errors: [] };
  const light: Coverage = { from: toEpoch(conn.wellnessSyncedFrom), until: toEpoch(conn.wellnessSyncedUntil) };
  const heart: Coverage = { from: toEpoch(conn.wellnessHrFrom), until: toEpoch(conn.wellnessHrUntil) };

  let saved = 0;
  try {
    const recent = opts.recent ?? true;
    // Senza punto di partenza lo storico non sa da dove andare a ritroso
    if (recent || light.from == null) saved += await runForward(ctx, light, LIGHT_TRACK, LIGHT_FIELDS, lightUnit, deadline);
    if (recent || heart.from == null) saved += await runForward(ctx, heart, HEART_TRACK, HEART_FIELDS, heartUnit, deadline);
    saved += await runBackward(ctx, light, LIGHT_TRACK, LIGHT_FIELDS, lightUnit, deadline);
    saved += await runBackward(ctx, heart, HEART_TRACK, HEART_FIELDS, heartUnit, deadline);
  } catch (error) {
    if (!(error instanceof UnitTimeout)) throw error;
    console.warn("benessere Mi Fitness: blocco interrotto per tempo, riprende alla prossima sincronizzazione");
  } finally {
    await prisma.miFitnessConnection.update({
      where: { userId },
      data: { wellnessZoneOffset: ctx.offset, wellnessError: ctx.errors.length ? ctx.errors.slice(0, 3).join(" · ").slice(0, 500) : null },
    });
  }
  return saved;
}
