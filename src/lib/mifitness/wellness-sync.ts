import { prisma } from "@/lib/prisma";
import type { SleepInput } from "@/lib/wellness/types";
import { UnitTimeout, runWellnessPlan, unitDays, type WellnessDriver } from "@/lib/wellness/engine";
import { HEART_TRACK, LIGHT_TRACK, type Unit } from "@/lib/wellness/plan";
import { fillSleepHeartRate, saveSleepSession, saveWellnessDays } from "@/lib/wellness/store";
import {
  MiFitnessError,
  listDailyReport,
  listFitnessData,
  type DailyReportRecord,
  type FitnessKey,
  type FitnessRecord,
  type XiaomiSession,
} from "./client";
import { dailyRestingHr, dailySleeps, heartRateSamples, mapSleepRecord, summarizeDays, zoneOffsetSeconds } from "./wellness-mapping";

/**
 * Benessere da Mi Fitness in blocchi piccoli e indipendenti (ordine e
 * cursori in lib/wellness/engine):
 * - dati "leggeri" (sonno, FC a riposo, passi, calorie, SpO2, stress) a
 *   blocchi di 10 giorni;
 * - battiti al minuto (migliaia al giorno) un giorno alla volta.
 */

const SOURCE = "MI_FITNESS" as const;
const DAY = 86_400;
/** Senza fuso noto si scarica con margine per coprire i giorni locali interi */
const ZONE_PAD = 14 * 3600;
/** Margine dei battiti col fuso noto: cambio d'ora e viaggi fino a ±3 h */
const HEART_PAD = 3 * 3600;
/** I battiti partono dalla sera prima: servono per la FC della notte */
const NIGHT_LEAD = 8 * 3600;
const MAX_PAGES = 300;
/** Oltre la scadenza un blocco in corso può finire entro questo margine */
const HARD_STOP_MS = 10_000;

const LIGHT_KEYS: FitnessKey[] = ["resting_heart_rate", "sleep", "steps", "calories", "spo2", "stress"];

interface Ctx {
  userId: string;
  session: XiaomiSession;
  region: string;
  hardStop: number;
  /** fuso dell'orologio in secondi, se già visto */
  offset: number | null;
  errors: string[];
}

/**
 * Istanti reali del blocco di giorni locali. Col fuso noto basta un margine
 * piccolo: copre il cambio d'ora e i viaggi vicini (il fuso salvato può
 * essere quello di prima). I giorni si filtrano poi col fuso di ogni dato.
 */
function unitRange(ctx: Ctx, unit: Unit, pad = ZONE_PAD) {
  const end = unit.from + unit.days * DAY;
  return ctx.offset == null
    ? { start: unit.from - ZONE_PAD, end: end + ZONE_PAD }
    : { start: unit.from - ctx.offset - pad, end: end - ctx.offset + pad };
}

type Page<R> = { records: R[]; hasMore: boolean; nextKey: string | null };

async function fetchPages<R>(ctx: Ctx, read: (nextKey: string | null) => Promise<Page<R>>) {
  const records: R[] = [];
  let nextKey: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() > ctx.hardStop) throw new UnitTimeout();
    const result = await read(nextKey);
    records.push(...result.records);
    if (!result.hasMore || !result.nextKey || seen.has(result.nextKey)) break;
    seen.add(result.nextKey);
    nextKey = result.nextKey;
  }
  return records;
}

/** Un tipo che fallisce non blocca gli altri; tempo scaduto e token scaduto sì */
async function tryPages<R>(ctx: Ctx, label: string, read: (nextKey: string | null) => Promise<Page<R>>) {
  try {
    return await fetchPages(ctx, read);
  } catch (error) {
    if (error instanceof UnitTimeout || (error instanceof MiFitnessError && error.auth)) throw error;
    console.warn("benessere Mi Fitness", label, error);
    ctx.errors.push(`${label}: ${error instanceof Error ? error.message : "errore"}`);
    return [];
  }
}

const tryFetch = (ctx: Ctx, key: FitnessKey, startTime: number, endTime: number) =>
  tryPages(ctx, key, (nextKey) => listFitnessData(ctx.session, ctx.region, { key, startTime, endTime, nextKey }));

/** Riepiloghi giornalieri dei giorni del blocco (time = mezzanotte UTC del giorno locale) */
const tryDaily = (ctx: Ctx, key: string, unit: Unit): Promise<DailyReportRecord[]> =>
  tryPages(ctx, `riepilogo ${key}`, (nextKey) =>
    listDailyReport(ctx.session, ctx.region, {
      key,
      startTime: unit.from - DAY,
      endTime: unit.from + (unit.days - 1) * DAY,
      nextKey,
    })
  );

/** Il fuso arriva con i dati: dalle volte successive i giorni si scaricano esatti */
function learnOffset(ctx: Ctx, records: FitnessRecord[]) {
  const last = [...records].reverse().find((r) => typeof r.zone_offset === "number");
  if (last) ctx.offset = zoneOffsetSeconds(last);
}

/**
 * Sonno, FC a riposo, passi, calorie, SpO2 e stress di un blocco di giorni.
 * Sonno e FC a riposo arrivano anche dai riepiloghi giornalieri, quelli
 * dell'app Mi Fitness: a volte i dati grezzi non vengono caricati.
 */
async function lightUnit(ctx: Ctx, unit: Unit) {
  const { start, end } = unitRange(ctx, unit);
  const data: Partial<Record<FitnessKey, FitnessRecord[]>> = {};
  for (const key of LIGHT_KEYS) data[key] = await tryFetch(ctx, key, start, end);
  const dailySleep = await tryDaily(ctx, "sleep", unit);
  const dailyHeart = await tryDaily(ctx, "heart_rate", unit);
  learnOffset(ctx, Object.values(data).flat());

  const keep = unitDays(unit).has;
  const summaries = summarizeDays(data);
  for (const [date, restingHr] of dailyRestingHr(dailyHeart)) {
    const day = summaries.get(date) ?? { date };
    day.restingHr ??= restingHr;
    summaries.set(date, day);
  }
  const saved = await saveWellnessDays(ctx.userId, SOURCE, summaries.values(), keep);

  // Prima i riepiloghi, poi i dati grezzi: hanno l'ipnogramma e completano la notte
  const raw = (data.sleep ?? []).map(mapSleepRecord).filter((s): s is SleepInput => s != null);
  for (const sleep of [...dailySleeps(dailySleep), ...raw]) {
    if (keep(sleep.date)) await saveSleepSession(ctx.userId, SOURCE, sleep);
  }
  return saved;
}

/** Battiti al minuto di un giorno: media, minimo, massimo, curva oraria e FC della notte */
async function heartUnit(ctx: Ctx, unit: Unit) {
  const { start, end } = unitRange(ctx, unit, HEART_PAD);
  const records = await tryFetch(ctx, "heart_rate", start - NIGHT_LEAD, end);
  learnOffset(ctx, records);
  const days = unitDays(unit);
  const saved = await saveWellnessDays(ctx.userId, SOURCE, summarizeDays({ heart_rate: records }).values(), days.has);
  await fillSleepHeartRate(ctx.userId, SOURCE, { from: days.first, to: days.last }, heartRateSamples(records));
  return saved;
}

/**
 * Recenti prima, poi lo storico finché c'è tempo (vedi runWellnessPlan).
 * Restituisce i giorni salvati.
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
  const driver: WellnessDriver = {
    userId,
    source: SOURCE,
    light: { track: LIGHT_TRACK, run: (unit) => lightUnit(ctx, unit) },
    heart: { track: HEART_TRACK, run: (unit) => heartUnit(ctx, unit) },
    saveCoverage: (data) => prisma.miFitnessConnection.update({ where: { userId }, data }),
  };
  try {
    return await runWellnessPlan(driver, conn, deadline, opts);
  } finally {
    await prisma.miFitnessConnection.update({
      where: { userId },
      data: { wellnessZoneOffset: ctx.offset, wellnessError: ctx.errors.length ? ctx.errors.slice(0, 3).join(" · ").slice(0, 500) : null },
    });
  }
}
