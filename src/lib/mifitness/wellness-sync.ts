import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WELLNESS_HISTORY_DAYS } from "@/lib/wellness/constants";
import type { DaySummary, SleepInput } from "@/lib/wellness/types";
import { MiFitnessError, listFitnessData, type FitnessKey, type FitnessRecord, type XiaomiSession } from "./client";
import { heartRateSamples, mapSleepRecord, summarizeDays, withSleepHeartRate } from "./wellness-mapping";

const DAY = 86_400;
/** Giorni per richiesta: i battiti al minuto sono tanti */
const WINDOW_DAYS = 3;
/** Margine per coprire i giorni locali interi in qualsiasi fuso (±14 h) */
const ZONE_PAD = 14 * 3600;
/** I dati dell'orologio arrivano in ritardo: gli ultimi giorni si rileggono */
const REFRESH_DAYS = 2;
const MAX_PAGES = 60;
const KEYS: FitnessKey[] = ["heart_rate", "resting_heart_rate", "sleep", "steps", "calories", "spo2", "stress"];

/** Oltre la scadenza una finestra in corso può finire entro questo margine */
const HARD_STOP_MS = 15_000;

/** Finestra interrotta per tempo: non si salva nulla, riprende la prossima volta */
class WindowTimeout extends Error {}

const utcMidnight = (epoch: number) => Math.floor(epoch / DAY) * DAY;
const isoDay = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 10);

async function fetchKey(
  session: XiaomiSession,
  region: string,
  key: FitnessKey,
  range: { startTime: number; endTime: number; hardStop: number }
) {
  const records: FitnessRecord[] = [];
  let nextKey: string | null = null;
  const seen = new Set<string>();
  const { startTime, endTime } = range;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() > range.hardStop) throw new WindowTimeout();
    const result = await listFitnessData(session, region, { key, startTime, endTime, nextKey });
    records.push(...result.records);
    if (!result.hasMore || !result.nextKey || seen.has(result.nextKey)) break;
    seen.add(result.nextKey);
    nextKey = result.nextKey;
  }
  return records;
}

/** Solo i campi misurati: un dato mancante non cancella quello già salvato */
function dayData(summary: DaySummary) {
  const { hrHourly, ...rest } = summary;
  const data: Prisma.WellnessDayUpdateInput = Object.fromEntries(
    Object.entries(rest).filter(([key, v]) => key !== "date" && v != null)
  );
  if (hrHourly?.length) data.hrHourly = hrHourly as unknown as Prisma.InputJsonValue;
  return data;
}

/** Campi della notte da salvare (l'id esterno è la chiave) */
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
    avgHr,
    minHr,
    stages: stages.length ? (stages as unknown as Prisma.InputJsonValue) : undefined,
  };
}

/**
 * Scarica e salva i giorni locali [from, from + days). Un tipo di dato che
 * fallisce non blocca gli altri; la sessione scaduta sì.
 */
async function syncWindow(userId: string, session: XiaomiSession, region: string, from: number, days: number, hardStop: number) {
  const data: Partial<Record<FitnessKey, FitnessRecord[]>> = {};
  for (const key of KEYS) {
    try {
      data[key] = await fetchKey(session, region, key, {
        startTime: from - ZONE_PAD,
        endTime: from + days * DAY + ZONE_PAD,
        hardStop,
      });
    } catch (error) {
      if (error instanceof WindowTimeout || (error instanceof MiFitnessError && error.auth)) throw error;
      console.warn("benessere Mi Fitness", key, error);
    }
  }

  const first = isoDay(from);
  const last = isoDay(from + (days - 1) * DAY);
  const inWindow = (date: string) => date >= first && date <= last;

  let saved = 0;
  for (const summary of summarizeDays(data).values()) {
    if (!inWindow(summary.date)) continue;
    const update = dayData(summary);
    if (!Object.keys(update).length) continue;
    await prisma.wellnessDay.upsert({
      where: { userId_date: { userId, date: summary.date } },
      update,
      create: { ...(update as Prisma.WellnessDayCreateWithoutUserInput), date: summary.date, user: { connect: { id: userId } } },
    });
    saved++;
  }

  const hr = heartRateSamples(data.heart_rate ?? []);
  for (const record of data.sleep ?? []) {
    const mapped = mapSleepRecord(record);
    if (!mapped || !inWindow(mapped.date)) continue;
    const sleep = sleepData(withSleepHeartRate(mapped, hr));
    await prisma.sleepSession.upsert({
      where: { userId_externalId: { userId, externalId: mapped.externalId } },
      update: sleep,
      create: { ...sleep, userId, externalId: mapped.externalId },
    });
  }
  return saved;
}

/**
 * Benessere dall'orologio: prima i giorni recenti (dall'ultima volta, con
 * margine), poi lo storico a ritroso finché c'è tempo. I cursori avanzano a
 * ogni finestra completata, così una sincronizzazione interrotta riprende.
 */
export async function syncWellness(userId: string, session: XiaomiSession, region: string, deadline: number) {
  try {
    return await syncRanges(userId, session, region, deadline);
  } catch (error) {
    if (!(error instanceof WindowTimeout)) throw error;
    console.warn("benessere Mi Fitness: finestra interrotta per tempo, riprende alla prossima sincronizzazione");
    return 0;
  }
}

async function syncRanges(userId: string, session: XiaomiSession, region: string, deadline: number) {
  const conn = await prisma.miFitnessConnection.findUnique({
    where: { userId },
    select: { wellnessSyncedUntil: true, wellnessSyncedFrom: true },
  });
  if (!conn) return 0;
  const today = utcMidnight(Date.now() / 1000);
  const tomorrow = today + DAY;
  const timeLeft = () => Date.now() < deadline;

  let saved = 0;
  const until = conn.wellnessSyncedUntil ? utcMidnight(conn.wellnessSyncedUntil.getTime() / 1000) : null;
  let cursor = until ? Math.min(until, today) - REFRESH_DAYS * DAY : today - (WINDOW_DAYS - 1) * DAY;
  const firstFrom = cursor;
  while (cursor < tomorrow && timeLeft()) {
    const days = Math.min(WINDOW_DAYS, (tomorrow - cursor) / DAY);
    saved += await syncWindow(userId, session, region, cursor, days, deadline + HARD_STOP_MS);
    cursor += days * DAY;
    await prisma.miFitnessConnection.update({
      where: { userId },
      data: {
        // Oggi è parziale: il cursore resta all'inizio di oggi
        wellnessSyncedUntil: new Date(Math.min(cursor, today) * 1000),
        ...(conn.wellnessSyncedFrom ? {} : { wellnessSyncedFrom: new Date(firstFrom * 1000) }),
      },
    });
  }

  const oldest = today - WELLNESS_HISTORY_DAYS * DAY;
  let from = conn.wellnessSyncedFrom ? utcMidnight(conn.wellnessSyncedFrom.getTime() / 1000) : firstFrom;
  while (from > oldest && timeLeft()) {
    const days = Math.min(WINDOW_DAYS, (from - oldest) / DAY);
    from -= days * DAY;
    saved += await syncWindow(userId, session, region, from, days, deadline + HARD_STOP_MS);
    await prisma.miFitnessConnection.update({ where: { userId }, data: { wellnessSyncedFrom: new Date(from * 1000) } });
  }
  return saved;
}
