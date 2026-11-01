import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarWeeks,
  format,
  getDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";

/**
 * Statistiche dell'attività (palestra + corsa) calcolate nel browser:
 * giorni e orari seguono il fuso orario di chi guarda.
 */

export interface ActivityItem {
  id: string;
  startedAt: Date;
  /** palestra, corsa, oppure bici e altre attività importate dall'orologio */
  kind: "gym" | "run" | "cardio";
  /** secondi */
  duration: number;
  volume: number;
  sets: number;
  /** metri, solo corse */
  distance: number;
  title: string;
  /** corsa collegata: la pagina di dettaglio è /run/[runId] */
  runId?: string | null;
}

export interface Totals {
  sessions: number;
  gym: number;
  runs: number;
  duration: number;
  /** bici, camminate, nuoto… */
  other: number;
  /** secondi per tipo */
  gymDuration: number;
  runDuration: number;
  otherDuration: number;
  volume: number;
  sets: number;
  /** metri di corsa (bici e altro a parte) */
  distance: number;
  otherDistance: number;
  activeDays: number;
}

const WEEK = { weekStartsOn: 1 } as const;
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const sum = (list: ActivityItem[], value: (i: ActivityItem) => number) => list.reduce((s, i) => s + value(i), 0);

export function totals(items: ActivityItem[]): Totals {
  const gym = items.filter((i) => i.kind === "gym");
  const runs = items.filter((i) => i.kind === "run");
  const other = items.filter((i) => i.kind === "cardio");
  return {
    sessions: items.length,
    gym: gym.length,
    runs: runs.length,
    other: other.length,
    duration: sum(items, (i) => i.duration),
    gymDuration: sum(gym, (i) => i.duration),
    runDuration: sum(runs, (i) => i.duration),
    otherDuration: sum(other, (i) => i.duration),
    volume: Math.round(sum(gym, (i) => i.volume)),
    sets: sum(gym, (i) => i.sets),
    distance: sum(runs, (i) => i.distance),
    otherDistance: sum(other, (i) => i.distance),
    activeDays: new Set(items.map((i) => dayKey(i.startedAt))).size,
  };
}

export type Period = "week" | "month" | "year" | "all";

/** Inizio del periodo (settimana, mese, anno) che contiene `date` */
export function periodStart(period: Exclude<Period, "all">, date: Date): Date {
  return period === "week" ? startOfWeek(date, WEEK) : period === "month" ? startOfMonth(date) : startOfYear(date);
}

/** Lo stesso giorno spostato di `delta` periodi */
export function shiftPeriod(period: Exclude<Period, "all">, date: Date, delta: number): Date {
  return period === "week" ? addWeeks(date, delta) : period === "month" ? addMonths(date, delta) : addYears(date, delta);
}

export interface PeriodWindow {
  /** null per "sempre" */
  from: Date | null;
  /** fine esclusa */
  to: Date | null;
  prevFrom: Date | null;
  /** fine esclusa del confronto */
  prevTo: Date | null;
  /** il periodo contiene oggi */
  isCurrent: boolean;
}

/**
 * Il periodo che contiene `anchor` e quello prima, per i confronti. Il
 * periodo in corso si confronta col precedente fino allo stesso punto (il
 * mese scorso fino al giorno di oggi); uno passato con il precedente intero.
 */
export function periodWindow(period: Period, anchor: Date, now: Date): PeriodWindow {
  if (period === "all") return { from: null, to: null, prevFrom: null, prevTo: null, isCurrent: true };
  const from = periodStart(period, anchor);
  const to = shiftPeriod(period, from, 1);
  const isCurrent = now >= from && now < to;
  const prevFrom = shiftPeriod(period, from, -1);
  // Fine esclusa: +1 ms include le sedute iniziate proprio "adesso" un periodo fa
  const prevTo = isCurrent ? new Date(shiftPeriod(period, now, -1).getTime() + 1) : from;
  return { from, to, prevFrom, prevTo, isCurrent };
}

/** Compatibile con prima: il periodo in corso e il precedente alla stessa data */
export function periodRange(period: Period, now: Date): { from: Date | null; prevFrom: Date | null; prevTo: Date | null } {
  const { from, prevFrom, prevTo } = periodWindow(period, now, now);
  return { from, prevFrom, prevTo };
}

/** Sedute nel periodo [from, to) */
export function itemsInPeriod(items: ActivityItem[], window: Pick<PeriodWindow, "from" | "to">) {
  return items.filter((i) => (!window.from || i.startedAt >= window.from) && (!window.to || i.startedAt < window.to));
}

export function periodTotals(items: ActivityItem[], period: Period, now: Date, anchor: Date = now) {
  const window = periodWindow(period, anchor, now);
  const current = totals(itemsInPeriod(items, window));
  const previous =
    window.prevFrom && window.prevTo ? totals(itemsInPeriod(items, { from: window.prevFrom, to: window.prevTo })) : null;
  return { current, previous, window };
}

/** "27 ott – 2 nov 2026", "ottobre 2026", "2026", "Da sempre" */
export function periodLabel(period: Period, anchor: Date): string {
  if (period === "all") return "Da sempre";
  const from = periodStart(period, anchor);
  if (period === "month") return format(from, "MMMM yyyy", { locale: it });
  if (period === "year") return format(from, "yyyy");
  const end = addDays(from, 6);
  const sameYear = from.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && from.getMonth() === end.getMonth();
  const start = format(from, sameMonth ? "d" : sameYear ? "d MMM" : "d MMM yyyy", { locale: it });
  return `${start} – ${format(end, "d MMM yyyy", { locale: it })}`;
}

export const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

/** Per giorno della settimana (0 = lunedì): sedute, tempo totale e medio */
export function weekdayStats(items: ActivityItem[]) {
  const days = WEEKDAYS.map((name) => ({ name, sessions: 0, gym: 0, runs: 0, other: 0, duration: 0, avgDuration: 0 }));
  for (const i of items) {
    const d = days[(getDay(i.startedAt) + 6) % 7];
    d.sessions++;
    d[i.kind === "gym" ? "gym" : i.kind === "run" ? "runs" : "other"]++;
    d.duration += i.duration;
  }
  for (const d of days) d.avgDuration = d.sessions ? Math.round(d.duration / d.sessions) : 0;
  return days;
}

export const TIME_SLOTS = [
  { key: "morning", label: "Mattina", range: "5-12", from: 5, to: 12 },
  { key: "afternoon", label: "Pomeriggio", range: "12-18", from: 12, to: 18 },
  { key: "evening", label: "Sera", range: "18-23", from: 18, to: 23 },
  { key: "night", label: "Notte", range: "23-5", from: 23, to: 5 },
] as const;

export function timeOfDay(items: ActivityItem[]) {
  const slots = TIME_SLOTS.map((s) => ({ ...s, sessions: 0 }));
  for (const i of items) {
    const h = i.startedAt.getHours();
    const slot = slots.find((s) => (s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to))!;
    slot.sessions++;
  }
  return slots;
}

export interface Bucket extends Totals {
  start: Date;
}

function bucketize(items: ActivityItem[], starts: Date[], end: (start: Date) => Date): Bucket[] {
  return starts.map((start) => {
    const stop = end(start);
    return { start, ...totals(items.filter((i) => i.startedAt >= start && i.startedAt < stop)) };
  });
}

/** Ultime `count` settimane (lunedì-domenica), dalla più vecchia */
export function weeklySeries(items: ActivityItem[], count: number, now: Date): Bucket[] {
  const current = startOfWeek(now, WEEK);
  const starts = Array.from({ length: count }, (_, i) => subWeeks(current, count - 1 - i));
  return bucketize(items, starts, (s) => addWeeks(s, 1));
}

/** Ultimi `count` mesi, dal più vecchio */
export function monthlySeries(items: ActivityItem[], count: number, now: Date): Bucket[] {
  const current = startOfMonth(now);
  const starts = Array.from({ length: count }, (_, i) => subMonths(current, count - 1 - i));
  return bucketize(items, starts, (s) => addMonths(s, 1));
}

/** Tutte le settimane con almeno un allenamento */
function activeWeeks(items: ActivityItem[]): Bucket[] {
  const groups = new Map<string, ActivityItem[]>();
  for (const i of items) {
    const key = dayKey(startOfWeek(i.startedAt, WEEK));
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  return Array.from(groups.values()).map((g) => ({ start: startOfWeek(g[0].startedAt, WEEK), ...totals(g) }));
}

function activeMonths(items: ActivityItem[]): Bucket[] {
  const groups = new Map<string, ActivityItem[]>();
  for (const i of items) {
    const key = format(i.startedAt, "yyyy-MM");
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  return Array.from(groups.values()).map((g) => ({ start: startOfMonth(g[0].startedAt), ...totals(g) }));
}

/** Il massimo per una metrica; a parità vince il tempo totale, poi il più recente */
function best<T extends { duration: number; start?: Date; startedAt?: Date }>(list: T[], metric: (x: T) => number): T | null {
  return list.reduce<T | null>((top, x) => {
    if (metric(x) <= 0) return top;
    if (!top || metric(x) > metric(top)) return x;
    if (metric(x) === metric(top) && x.duration >= top.duration) return x;
    return top;
  }, null);
}

/** Costanza: settimane con almeno un allenamento sulle ultime `weeks` */
export function consistency(items: ActivityItem[], weeks: number, now: Date) {
  const series = weeklySeries(items, weeks, now);
  // La settimana in corso conta solo se c'è già un allenamento
  const considered = series[series.length - 1].sessions ? series : series.slice(0, -1);
  const active = considered.filter((w) => w.sessions > 0).length;
  const sessions = considered.reduce((s, w) => s + w.sessions, 0);
  return {
    weeks: considered.length,
    activeWeeks: active,
    percent: considered.length ? Math.round((active / considered.length) * 100) : 0,
    avgPerWeek: considered.length ? Math.round((sessions / considered.length) * 10) / 10 : 0,
  };
}

export interface Records {
  bestWeekSessions: Bucket | null;
  bestWeekDuration: Bucket | null;
  bestWeekVolume: Bucket | null;
  bestWeekDistance: Bucket | null;
  bestMonth: Bucket | null;
  longestSession: ActivityItem | null;
  heaviestSession: ActivityItem | null;
  mostSetsSession: ActivityItem | null;
  longestRun: ActivityItem | null;
  favoriteDay: ReturnType<typeof weekdayStats>[number] | null;
  longestDay: ReturnType<typeof weekdayStats>[number] | null;
  favoriteSlot: ReturnType<typeof timeOfDay>[number] | null;
  avgGymDuration: number;
  activeDays: number;
  firstDate: Date | null;
}

export function records(items: ActivityItem[]): Records {
  const weeks = activeWeeks(items);
  const gym = items.filter((i) => i.kind === "gym");
  const runs = items.filter((i) => i.kind === "run");
  const days = weekdayStats(items);
  const slots = timeOfDay(items);
  return {
    bestWeekSessions: best(weeks, (w) => w.sessions),
    bestWeekDuration: best(weeks, (w) => w.duration),
    bestWeekVolume: best(weeks, (w) => w.volume),
    bestWeekDistance: best(weeks, (w) => w.distance),
    bestMonth: best(activeMonths(items), (m) => m.sessions),
    longestSession: best(items, (i) => i.duration),
    heaviestSession: best(gym, (i) => i.volume),
    mostSetsSession: best(gym, (i) => i.sets),
    longestRun: best(runs, (i) => i.distance),
    favoriteDay: best(days, (d) => d.sessions),
    // Il giorno con più tempo in media, ma solo se ci si allena con una certa regolarità
    longestDay: best(
      days.filter((d) => d.sessions >= Math.max(2, Math.ceil(items.length / 20))),
      (d) => d.avgDuration
    ),
    favoriteSlot: slots.reduce<(typeof slots)[number] | null>((t, s) => (s.sessions > (t?.sessions ?? 0) ? s : t), null),
    avgGymDuration: gym.length ? Math.round(gym.reduce((s, i) => s + i.duration, 0) / gym.length) : 0,
    activeDays: new Set(items.map((i) => dayKey(i.startedAt))).size,
    firstDate: items.length ? items.reduce((a, i) => (i.startedAt < a ? i.startedAt : a), items[0].startedAt) : null,
  };
}

/** Settimane dall'inizio, per "da N settimane" */
export const weeksSince = (from: Date, now: Date) => differenceInCalendarWeeks(now, from, WEEK) + 1;

/** Attività per giorno (chiave yyyy-MM-dd locale) per calendario e heatmap */
export function byDay(items: ActivityItem[]): Map<string, ActivityItem[]> {
  const map = new Map<string, ActivityItem[]>();
  for (const i of items) {
    const key = dayKey(i.startedAt);
    map.set(key, [...(map.get(key) ?? []), i]);
  }
  return map;
}
