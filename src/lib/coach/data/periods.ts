/**
 * Periodi delle domande sui dati ("quest'anno", "ultime 4 settimane"…)
 * tradotti in istanti precisi nel fuso dell'utente. Il server gira in UTC:
 * senza fuso un allenamento del 31 dicembre sera finirebbe nell'anno dopo.
 */

export const COACH_TIME_ZONE = "Europe/Rome";

export const PERIOD_PRESETS = [
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "last_n_weeks",
  "last_n_days",
  "since_start",
  "custom",
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export interface PeriodRequest {
  preset: PeriodPreset;
  /** per last_n_weeks / last_n_days */
  n?: number | null;
  /** per custom: giorni locali yyyy-MM-dd, estremi inclusi */
  from?: string | null;
  to?: string | null;
}

export interface ResolvedPeriod {
  /** istante iniziale incluso */
  from: Date;
  /** istante finale escluso */
  to: Date;
  /** giorni locali, estremi inclusi, da scrivere nella risposta */
  fromDay: string;
  toDay: string;
  label: string;
}

interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = ({ year, month, day }: LocalDate) => `${year}-${pad(month)}-${pad(day)}`;

/** Minuti da aggiungere all'UTC per avere l'ora locale (Roma: +60 o +120) */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Mezzanotte locale del giorno indicato, come istante UTC */
export function localMidnight(date: LocalDate, timeZone = COACH_TIME_ZONE): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  // Seconda passata: corregge il giorno del cambio dell'ora legale
  const second = guess - offsetMinutes(new Date(first), timeZone) * 60_000;
  return new Date(second);
}

/** Giorno locale di un istante */
export function localDate(instant: Date, timeZone = COACH_TIME_ZONE): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    instant
  );
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export const localDayKey = (instant: Date, timeZone = COACH_TIME_ZONE): string => isoDay(localDate(instant, timeZone));

/** Somma giorni a una data di calendario (senza fuso) */
function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = lunedì … 6 = domenica */
const weekdayIndex = (date: LocalDate) => (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;

function parseDay(value: string | null | undefined): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return check.getUTCMonth() === date.month - 1 && check.getUTCDate() === date.day ? date : null;
}

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export function formatDayIt(day: string): string {
  const date = parseDay(day);
  if (!date) return day;
  return `${date.day === 1 ? "1°" : date.day} ${MONTHS[date.month - 1]} ${date.year}`;
}

export class InvalidPeriodError extends Error {}

/** Numero di periodi, limitato a un intervallo sensato */
const clampCount = (n: number | null | undefined, max: number) => Math.min(Math.max(Math.round(n ?? 1), 1), max);

/**
 * Traduce la richiesta in un intervallo [from, to). "Oggi" è incluso: i
 * periodi in corso arrivano fino alla fine della giornata di oggi.
 */
export function resolvePeriod(
  request: PeriodRequest,
  now: Date,
  firstActivity: Date | null,
  timeZone = COACH_TIME_ZONE
): ResolvedPeriod {
  const today = localDate(now, timeZone);
  const tomorrow = addDays(today, 1);
  let start: LocalDate;
  let endExclusive: LocalDate = tomorrow;
  let label: string;

  switch (request.preset) {
    case "this_week":
      start = addDays(today, -weekdayIndex(today));
      label = "questa settimana";
      break;
    case "last_week": {
      const monday = addDays(today, -weekdayIndex(today));
      start = addDays(monday, -7);
      endExclusive = monday;
      label = "la settimana scorsa";
      break;
    }
    case "this_month":
      start = { ...today, day: 1 };
      label = `${MONTHS[today.month - 1]} ${today.year}`;
      break;
    case "last_month": {
      const firstOfThis = { ...today, day: 1 };
      start = today.month === 1 ? { year: today.year - 1, month: 12, day: 1 } : { year: today.year, month: today.month - 1, day: 1 };
      endExclusive = firstOfThis;
      label = `${MONTHS[start.month - 1]} ${start.year}`;
      break;
    }
    case "this_year":
      start = { year: today.year, month: 1, day: 1 };
      label = `quest'anno (${today.year})`;
      break;
    case "last_year":
      start = { year: today.year - 1, month: 1, day: 1 };
      endExclusive = { year: today.year, month: 1, day: 1 };
      label = `l'anno scorso (${today.year - 1})`;
      break;
    case "last_n_weeks": {
      const n = clampCount(request.n, 260);
      start = addDays(tomorrow, -7 * n);
      label = n === 1 ? "gli ultimi 7 giorni" : `le ultime ${n} settimane`;
      break;
    }
    case "last_n_days": {
      const n = clampCount(request.n, 1825);
      start = addDays(tomorrow, -n);
      label = n === 1 ? "oggi" : `gli ultimi ${n} giorni`;
      break;
    }
    case "since_start":
      start = firstActivity ? localDate(firstActivity, timeZone) : today;
      label = "da quando usi l'app";
      break;
    case "custom": {
      const from = parseDay(request.from);
      const to = parseDay(request.to) ?? today;
      if (!from) throw new InvalidPeriodError("Per un periodo personalizzato serve 'from' nel formato yyyy-MM-dd");
      if (isoDay(from) > isoDay(to)) throw new InvalidPeriodError("'from' è successivo a 'to'");
      start = from;
      endExclusive = addDays(to, 1);
      label = `dal ${formatDayIt(isoDay(from))} al ${formatDayIt(isoDay(to))}`;
      break;
    }
  }

  const lastIncluded = addDays(endExclusive, -1);
  return {
    from: localMidnight(start, timeZone),
    to: localMidnight(endExclusive, timeZone),
    fromDay: isoDay(start),
    toDay: isoDay(lastIncluded),
    label,
  };
}

/** Settimana (lunedì) e mese locali di un istante, per i raggruppamenti */
export function weekKey(instant: Date, timeZone = COACH_TIME_ZONE): string {
  const date = localDate(instant, timeZone);
  return isoDay(addDays(date, -weekdayIndex(date)));
}

export function monthKey(instant: Date, timeZone = COACH_TIME_ZONE): string {
  const date = localDate(instant, timeZone);
  return `${date.year}-${pad(date.month)}`;
}

/** Settimane (anche frazionarie) coperte dal periodo, per le medie */
export function weeksInPeriod(period: Pick<ResolvedPeriod, "from" | "to">): number {
  return Math.max((period.to.getTime() - period.from.getTime()) / (7 * 86_400_000), 1 / 7);
}
