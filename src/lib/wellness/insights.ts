import { addDays, format, parseISO, subDays } from "date-fns";
import type { ActivityItem } from "@/lib/insights";
import type { SleepJson, WellnessDayJson } from "./types";

/**
 * Analisi del benessere calcolate nel browser: sonno, battiti e il loro
 * legame con gli allenamenti (palestra e corsa) del giorno prima.
 */

/** Sonno di riferimento per notte (7 h 30) */
export const SLEEP_NEED_MIN = 450;
export const STEPS_GOAL = 10_000;

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");
const prevDay = (date: string) => dayKey(subDays(parseISO(date), 1));
const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const defined = <T>(values: (T | null | undefined)[]) => values.filter((v): v is T => v != null);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Una notte per giorno di risveglio (la più lunga), senza pisolini */
export function mainSleeps(sleeps: SleepJson[]): SleepJson[] {
  const byDate = new Map<string, SleepJson>();
  for (const s of sleeps) {
    if (s.isNap) continue;
    const current = byDate.get(s.date);
    if (!current || s.asleep > current.asleep) byDate.set(s.date, s);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Tempo addormentato sul tempo a letto (0-1): Xiaomi non dà un punteggio */
export function sleepEfficiency(s: Pick<SleepJson, "asleep" | "startAt" | "endAt">): number | null {
  const inBed = (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 60_000;
  return inBed > 0 && s.asleep > 0 ? Math.min(1, s.asleep / inBed) : null;
}

export const deepShare = (s: SleepJson) => (s.deep != null && s.asleep > 0 ? s.deep / s.asleep : null);
export const remShare = (s: SleepJson) => (s.rem != null && s.asleep > 0 ? s.rem / s.asleep : null);

// ─── Allenamento del giorno prima ─────────────────────────────────────────────

export type DayKind = "gym" | "run" | "both" | "rest";

export interface TrainingDay {
  kind: DayKind;
  minutes: number;
  /** ora di inizio dell'ultima seduta (0-23) */
  lastHour: number;
}

export function trainingByDay(activity: ActivityItem[]): Map<string, TrainingDay> {
  const days = new Map<string, TrainingDay>();
  for (const a of activity) {
    const key = dayKey(a.startedAt);
    const day = days.get(key) ?? { kind: "rest" as DayKind, minutes: 0, lastHour: 0 };
    // Bici e altre attività di resistenza pesano sul sonno come la corsa
    const activity: DayKind = a.kind === "gym" ? "gym" : "run";
    const kind: DayKind = day.kind === "rest" || day.kind === activity ? activity : "both";
    days.set(key, {
      kind,
      minutes: day.minutes + a.duration / 60,
      lastHour: Math.max(day.lastHour, a.startedAt.getHours()),
    });
  }
  return days;
}

export interface SleepGroup {
  key: "rest" | "gym" | "run" | "late";
  label: string;
  /** etichetta breve per le tabelle */
  short: string;
  nights: number;
  asleep: number | null;
  deepPct: number | null;
  score: number | null;
  sleepHr: number | null;
  /** FC a riposo del mattino dopo */
  restingHr: number | null;
}

const GROUP_LABEL: Record<SleepGroup["key"], string> = {
  rest: "Dopo un giorno di riposo",
  gym: "Dopo la palestra",
  run: "Dopo la corsa",
  late: "Dopo un allenamento serale",
};
const GROUP_SHORT: Record<SleepGroup["key"], string> = { rest: "Riposo", gym: "Palestra", run: "Corsa", late: "Serale" };
/** Dalle 19 in poi l'allenamento è "serale" */
const LATE_HOUR = 19;

function groupStats(key: SleepGroup["key"], nights: SleepJson[], restingByDate: Map<string, number>): SleepGroup {
  const deep = defined(nights.map(deepShare));
  return {
    key,
    label: GROUP_LABEL[key],
    short: GROUP_SHORT[key],
    nights: nights.length,
    asleep: mean(nights.map((n) => n.asleep)),
    deepPct: deep.length ? mean(deep)! * 100 : null,
    score: mean(defined(nights.map((n) => n.score))),
    sleepHr: mean(defined(nights.map((n) => n.avgHr))),
    restingHr: mean(defined(nights.map((n) => restingByDate.get(n.date)))),
  };
}

/** Come dormi in base all'allenamento del giorno prima */
export function sleepByTraining(sleeps: SleepJson[], activity: ActivityItem[], days: WellnessDayJson[]): SleepGroup[] {
  const training = trainingByDay(activity);
  const resting = new Map(days.filter((d) => d.restingHr != null).map((d) => [d.date, d.restingHr!]));
  const buckets: Record<SleepGroup["key"], SleepJson[]> = { rest: [], gym: [], run: [], late: [] };
  for (const night of mainSleeps(sleeps)) {
    const day = training.get(prevDay(night.date));
    if (!day) buckets.rest.push(night);
    else {
      if (day.kind === "gym" || day.kind === "both") buckets.gym.push(night);
      if (day.kind === "run" || day.kind === "both") buckets.run.push(night);
      if (day.lastHour >= LATE_HOUR) buckets.late.push(night);
    }
  }
  return (Object.keys(buckets) as SleepGroup["key"][])
    .map((key) => groupStats(key, buckets[key], resting))
    .filter((g) => g.nights > 0);
}

export interface Finding {
  tone: "good" | "bad" | "neutral";
  text: string;
}

const MIN_NIGHTS = 3;
const minutesText = (m: number) => `${Math.round(Math.abs(m))} min`;

/** Le differenze che contano tra notti dopo l'allenamento e dopo il riposo */
export function sleepTrainingFindings(groups: SleepGroup[]): Finding[] {
  const rest = groups.find((g) => g.key === "rest");
  if (!rest || rest.nights < MIN_NIGHTS) return [];
  const out: Finding[] = [];
  for (const g of groups) {
    if (g.key === "rest" || g.nights < MIN_NIGHTS) continue;
    const what = g.key === "late" ? "dopo gli allenamenti serali" : g.key === "gym" ? "dopo la palestra" : "dopo la corsa";
    if (g.asleep != null && rest.asleep != null && Math.abs(g.asleep - rest.asleep) >= 15) {
      const more = g.asleep > rest.asleep;
      out.push({ tone: more ? "good" : "bad", text: `${capitalize(what)} dormi ${minutesText(g.asleep - rest.asleep)} ${more ? "in più" : "in meno"}` });
    }
    if (g.deepPct != null && rest.deepPct != null && Math.abs(g.deepPct - rest.deepPct) >= 2) {
      const more = g.deepPct > rest.deepPct;
      out.push({
        tone: more ? "good" : "bad",
        text: `Sonno profondo ${more ? "più" : "meno"} lungo ${what} (${Math.round(g.deepPct)}% contro ${Math.round(rest.deepPct)}%)`,
      });
    }
    if (g.sleepHr != null && rest.sleepHr != null && Math.abs(g.sleepHr - rest.sleepHr) >= 2) {
      const higher = g.sleepHr > rest.sleepHr;
      out.push({
        tone: higher ? "bad" : "good",
        text: `${capitalize(what)} il cuore di notte batte ${Math.round(Math.abs(g.sleepHr - rest.sleepHr))} bpm ${higher ? "più veloce: recupero in corso" : "più piano"}`,
      });
    }
  }
  return out;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Regolarità e debito di sonno ─────────────────────────────────────────────

/** Minuti dalle 18:00 locali: la mezzanotte non spezza la media */
const eveningMinutes = (iso: string) => {
  const d = new Date(iso);
  return (d.getHours() * 60 + d.getMinutes() - 18 * 60 + 1440) % 1440;
};
const fromEvening = (m: number) => {
  const total = Math.round(m + 18 * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

function spread(values: number[]): number | null {
  const m = mean(values);
  if (m == null || values.length < 3) return null;
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2))!);
}

export interface SleepRoutine {
  bedtime: string | null;
  wake: string | null;
  /** deviazione media dell'orario (minuti) */
  variation: number | null;
  label: string | null;
  debt: number;
  nights: number;
}

/** Ultime due settimane: orari medi, regolarità e debito degli ultimi 7 giorni */
export function sleepRoutine(sleeps: SleepJson[], now = new Date()): SleepRoutine {
  const since = dayKey(subDays(now, 14));
  const nights = mainSleeps(sleeps).filter((s) => s.date > since);
  const beds = nights.map((n) => eveningMinutes(n.startAt));
  const wakes = nights.map((n) => eveningMinutes(n.endAt));
  const variation = mean(defined([spread(beds), spread(wakes)]));
  const weekStart = dayKey(subDays(now, 7));
  const debt = nights.filter((n) => n.date > weekStart).reduce((s, n) => s + Math.max(0, SLEEP_NEED_MIN - n.asleep), 0);
  return {
    bedtime: beds.length ? fromEvening(mean(beds)!) : null,
    wake: wakes.length ? fromEvening(mean(wakes)!) : null,
    variation,
    label: variation == null ? null : variation <= 30 ? "Molto regolare" : variation <= 60 ? "Abbastanza regolare" : "Irregolare",
    debt,
    nights: nights.length,
  };
}

// ─── Battiti ──────────────────────────────────────────────────────────────────

export interface RestingTrend {
  latest: number | null;
  latestDate: string | null;
  /** mediana dei 30 giorni prima degli ultimi 3 */
  baseline: number | null;
  /** ultimo valore meno la base */
  delta: number | null;
  /** variazione tra le prime e le ultime due settimane del periodo */
  longTerm: number | null;
}

export function restingTrend(days: WellnessDayJson[]): RestingTrend {
  const series = days.filter((d) => d.restingHr != null);
  if (!series.length) return { latest: null, latestDate: null, baseline: null, delta: null, longTerm: null };
  const values = series.map((d) => d.restingHr!);
  const baseline = median(values.slice(-33, -3));
  // Tendenza sugli ultimi tre mesi, anche con uno storico più lungo
  const threeMonthsAgo = dayKey(subDays(parseISO(series.at(-1)!.date), 89));
  const recent = series.filter((d) => d.date >= threeMonthsAgo).map((d) => d.restingHr!);
  const head = recent.slice(0, 14);
  const tail = recent.slice(-14);
  return {
    latest: values.at(-1)!,
    latestDate: series.at(-1)!.date,
    baseline,
    delta: baseline == null ? null : values.at(-1)! - baseline,
    longTerm: recent.length >= 42 ? mean(tail)! - mean(head)! : null,
  };
}

// ─── Punteggio sonno ──────────────────────────────────────────────────────────

export type Tone = "good" | "neutral" | "warn" | "bad";

export interface ScoreFactor<K extends string> {
  key: K;
  label: string;
  score: number;
  detail: string;
}

export interface SleepScore {
  score: number;
  label: string;
  tone: Tone;
  factors: ScoreFactor<"duration" | "efficiency" | "stages" | "calm">[];
}

/** Sotto le 2 ore la durata vale 0, da 8 ore in su 100 */
const SLEEP_FLOOR_MIN = 120;
const SLEEP_FULL_MIN = 480;
/** Quote di profondo e REM oltre cui la fase vale piena */
const DEEP_TARGET = 0.2;
const REM_TARGET = 0.22;
const SLEEP_WEIGHTS = { duration: 0.5, efficiency: 0.2, stages: 0.2, calm: 0.1 };
/** Dormire poco non si compensa: al massimo 20 punti oltre la durata */
const DURATION_CAP_MARGIN = 20;

const weighted = <K extends string>(factors: ScoreFactor<K>[], weights: Record<K, number>) =>
  factors.reduce((s, f) => s + f.score * weights[f.key], 0) / factors.reduce((s, f) => s + weights[f.key], 0);

/**
 * Quanto hai dormito bene (0-100): durata, efficienza, profondo e REM,
 * continuità. 0 è non aver dormito, 100 un riposo completo. Pesa solo ciò
 * che l'orologio ha misurato; la durata limita il totale.
 */
export function sleepScore(night: SleepJson): SleepScore {
  const duration = clamp(((night.asleep - SLEEP_FLOOR_MIN) / (SLEEP_FULL_MIN - SLEEP_FLOOR_MIN)) * 100);
  const factors: SleepScore["factors"] = [{ key: "duration", label: "Durata", score: duration, detail: formatMinutes(night.asleep) }];

  const efficiency = sleepEfficiency(night);
  if (efficiency != null) {
    factors.push({
      key: "efficiency",
      label: "Efficienza",
      score: clamp(((efficiency - 0.7) / 0.25) * 100),
      detail: `${Math.round(efficiency * 100)}% del tempo a letto`,
    });
  }

  const deep = deepShare(night);
  const rem = remShare(night);
  if (deep != null && rem != null) {
    factors.push({
      key: "stages",
      label: "Profondo e REM",
      score: (Math.min(1, deep / DEEP_TARGET) + Math.min(1, rem / REM_TARGET)) * 50,
      detail: `profondo ${Math.round(deep * 100)}%, REM ${Math.round(rem * 100)}%`,
    });
  }

  if (night.awake != null) {
    const wakes = night.awakeCount ?? 0;
    factors.push({
      key: "calm",
      label: "Continuità",
      score: clamp(100 - Math.max(0, night.awake - 10) * 2 - Math.max(0, wakes - 2) * 5),
      detail: `${formatMinutes(night.awake)} sveglio${night.awakeCount != null ? `, ${wakes} risvegli` : ""}`,
    });
  }

  const score = night.asleep > 0 ? Math.round(Math.min(weighted(factors, SLEEP_WEIGHTS), duration + DURATION_CAP_MARGIN)) : 0;
  const [label, tone]: [string, Tone] =
    score >= 85 ? ["Ottimo", "good"] : score >= 70 ? ["Buono", "neutral"] : score >= 50 ? ["Discreto", "warn"] : ["Scarso", "bad"];
  return { score, label, tone, factors: factors.map((f) => ({ ...f, score: Math.round(f.score) })) };
}

// ─── Prontezza ────────────────────────────────────────────────────────────────

export interface Readiness {
  score: number;
  label: string;
  tone: Tone;
  factors: ScoreFactor<"sleep" | "heart" | "load">[];
  /** segnali di recupero non ancora arrivati dall'orologio */
  missing: ("sleep" | "heart")[];
}

/**
 * Carico acuto/cronico dai minuti di allenamento (7 contro 28 giorni).
 * Serve allenamento in almeno 3 delle 4 settimane: chi riprende dopo una
 * pausa avrebbe sempre una "settimana più intensa del solito".
 */
export function loadRatio(activity: ActivityItem[], now = new Date()): number | null {
  const recent = activity.filter((a) => a.startedAt > subDays(now, 28) && a.startedAt <= now);
  const weeks = new Set(recent.map((a) => Math.floor((now.getTime() - a.startedAt.getTime()) / (7 * 86_400_000))));
  if (weeks.size < 3) return null;
  const minutesSince = (days: number) => {
    const from = subDays(now, days);
    return recent.filter((a) => a.startedAt > from).reduce((s, a) => s + a.duration / 60, 0);
  };
  const chronic = minutesSince(28) / 4;
  if (chronic < 30) return null;
  return minutesSince(7) / chronic;
}

/**
 * Quanto sei pronto oggi (0-100): sonno della notte, FC a riposo rispetto
 * alla tua base e carico della settimana. Pesa solo ciò che è misurato,
 * ma senza sonno né FC a riposo non c'è prontezza: il carico da solo non
 * dice quanto hai recuperato.
 */
export function readiness(
  sleeps: SleepJson[],
  days: WellnessDayJson[],
  activity: ActivityItem[],
  now = new Date()
): Readiness | null {
  const factors: Readiness["factors"] = [];
  const today = dayKey(now);
  const yesterday = dayKey(subDays(now, 1));
  const lastNight = mainSleeps(sleeps).filter((s) => s.date === today || s.date === yesterday).at(-1);
  if (lastNight) {
    const efficiency = sleepEfficiency(lastNight);
    const detail = `${formatMinutes(lastNight.asleep)} di sonno${efficiency != null ? `, efficienza ${Math.round(efficiency * 100)}%` : ""}`;
    factors.push({ key: "sleep", label: "Sonno", score: sleepScore(lastNight).score, detail });
  }

  const trend = restingTrend(days);
  if (trend.delta != null && trend.latestDate && trend.latestDate >= yesterday) {
    const diff = trend.delta;
    factors.push({
      key: "heart",
      label: "FC a riposo",
      score: clamp(100 - Math.max(0, diff) * 12),
      detail: Math.abs(diff) < 1 ? "nella tua norma" : `${diff > 0 ? "+" : "−"}${Math.round(Math.abs(diff))} bpm sulla tua norma`,
    });
  }

  const ratio = loadRatio(activity, now);
  if (ratio != null) {
    factors.push({
      key: "load",
      label: "Carico",
      score: clamp(ratio <= 1.1 ? 100 : 100 - (ratio - 1.1) * 120),
      detail: ratio > 1.3 ? "settimana più intensa del solito" : ratio < 0.6 ? "settimana leggera" : "nella tua media",
    });
  }

  const missing = (["sleep", "heart"] as const).filter((key) => !factors.some((f) => f.key === key));
  if (missing.length === 2) return null;
  const score = Math.round(weighted(factors, { sleep: 0.45, heart: 0.35, load: 0.2 }));
  const [label, tone]: [string, Tone] =
    score >= 75 ? ["Pronto a spingere", "good"] : score >= 55 ? ["Allenamento normale", "neutral"] : score >= 40 ? ["Meglio andare leggeri", "warn"] : ["Giornata di recupero", "bad"];
  return { score, label, tone, factors: factors.map((f) => ({ ...f, score: Math.round(f.score) })), missing: [...missing] };
}

// ─── Passi ────────────────────────────────────────────────────────────────────

export interface StepsSummary {
  today: number | null;
  avg7: number | null;
  avg30: number | null;
  goalDays30: number;
  best: { date: string; steps: number } | null;
}

export function stepsSummary(days: WellnessDayJson[], now = new Date()): StepsSummary {
  const withSteps = days.filter((d) => d.steps != null && d.steps > 0);
  const since = (n: number) => withSteps.filter((d) => d.date > dayKey(subDays(now, n)));
  const avgOf = (list: WellnessDayJson[]) => (list.length ? Math.round(mean(list.map((d) => d.steps!))!) : null);
  const last30 = since(30);
  const best = last30.reduce<WellnessDayJson | null>((b, d) => (!b || d.steps! > b.steps! ? d : b), null);
  return {
    today: withSteps.find((d) => d.date === dayKey(now))?.steps ?? null,
    avg7: avgOf(since(7)),
    avg30: avgOf(last30),
    goalDays30: last30.filter((d) => d.steps! >= STEPS_GOAL).length,
    best: best ? { date: best.date, steps: best.steps! } : null,
  };
}

/** Ultimi `n` giorni fino a oggi, anche quelli senza dati */
export function lastDays(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(addDays(subDays(now, n - 1), i)));
}

// ─── Periodi dei grafici ──────────────────────────────────────────────────────

export type TrendRange = "3m" | "6m" | "1y";
export const TREND_RANGES: { value: TrendRange; label: string; days: number }[] = [
  { value: "3m", label: "3 mesi", days: 90 },
  { value: "6m", label: "6 mesi", days: 182 },
  { value: "1y", label: "1 anno", days: 365 },
];
/** Oltre questi giorni un punto al giorno è illeggibile: medie settimanali */
const DAILY_POINTS_MAX = 90;

/**
 * Punti di un andamento negli ultimi `days` giorni: uno al giorno fino a tre
 * mesi, poi la media di ogni settimana (che finisce oggi) dei giorni con dati.
 */
export function trendPoints(days: number, value: (date: string) => number | null, now = new Date()) {
  const dates = lastDays(days, now);
  if (days <= DAILY_POINTS_MAX) return dates.map((date) => ({ date, value: value(date) }));
  const points: { date: string; value: number | null }[] = [];
  // Settimane allineate a oggi: l'ultima è sempre completa fino a ieri/oggi
  for (let end = dates.length; end > 0; end -= 7) {
    const week = dates.slice(Math.max(0, end - 7), end);
    const values = week.map(value).filter((v): v is number => v != null);
    points.unshift({ date: week[0], value: values.length ? mean(values)! : null });
  }
  return points;
}

/** 452 → "7h 32m" */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`;
}
