import type { DaySummary, HourlyHr, SleepInput, SleepSegment, SleepStage } from "@/lib/wellness/types";
import type { FitnessKey, FitnessRecord } from "./client";

/**
 * Dati salute di Mi Fitness → riepiloghi giornalieri e notti. Funzioni pure:
 * i campioni al minuto non si salvano, restano solo gli aggregati.
 * Nomi dei campi da mi-fitness-mcp-cn (MIT); se mancano si salta il dato.
 */

type Payload = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const firstNum = (p: Payload, ...keys: string[]) => {
  for (const k of keys) {
    const v = num(p[k]);
    if (v != null) return v;
  }
  return null;
};
const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
const round = (v: number, digits = 0) => Math.round(v * 10 ** digits) / 10 ** digits;

export function parsePayload(record: FitnessRecord): Payload {
  if (record.value && typeof record.value === "object") return record.value;
  try {
    const parsed = typeof record.value === "string" ? JSON.parse(record.value) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Fuso in secondi; alcuni dati lo danno in quarti d'ora */
export function zoneOffsetSeconds(record: FitnessRecord): number {
  const z = num(record.zone_offset) ?? 0;
  return Math.abs(z) <= 56 ? z * 900 : z;
}

/** Istante (secondi) → giorno e ora locali dell'orologio */
export function localParts(epoch: number, offset: number): { date: string; hour: number } {
  const local = new Date((epoch + offset) * 1000);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours() };
}

export interface Sample {
  time: number;
  value: number;
  offset: number;
}

/** Campioni validi di una chiave (valore nel range plausibile) */
export function samplesOf(records: FitnessRecord[], fields: string[], range: [number, number], timeFields: string[] = ["time"]): Sample[] {
  const out: Sample[] = [];
  for (const record of records) {
    const p = parsePayload(record);
    const value = firstNum(p, ...fields);
    const time = firstNum(p, ...timeFields) ?? num(record.time);
    if (value == null || time == null || value < range[0] || value > range[1]) continue;
    out.push({ time, value, offset: zoneOffsetSeconds(record) });
  }
  return out;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const groupByDay = (samples: Sample[]) => {
  const days = new Map<string, Sample[]>();
  for (const s of samples) push(days, localParts(s.time, s.offset).date, s);
  return days;
};

const min = (values: number[]) => values.reduce((m, v) => (v < m ? v : m), Infinity);
const max = (values: number[]) => values.reduce((m, v) => (v > m ? v : m), -Infinity);

function hourly(samples: Sample[]): HourlyHr[] {
  const hours = new Map<number, number[]>();
  for (const s of samples) push(hours, localParts(s.time, s.offset).hour, s.value);
  return [...hours.entries()]
    .sort(([a], [b]) => a - b)
    .map(([h, v]) => ({ h, avg: Math.round(avg(v)), min: min(v), max: max(v) }));
}

/** Range plausibili: fuori sono errori del sensore */
const HR_RANGE: [number, number] = [25, 230];
const SPO2_RANGE: [number, number] = [70, 100];
const STRESS_RANGE: [number, number] = [1, 100];

export const heartRateSamples = (records: FitnessRecord[]) => samplesOf(records, ["bpm", "hr", "value"], HR_RANGE);

/** Tutti i dati di un intervallo → un riepilogo per giorno locale */
export function summarizeDays(data: Partial<Record<FitnessKey, FitnessRecord[]>>): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();
  const day = (date: string) => {
    if (!days.has(date)) days.set(date, { date });
    return days.get(date)!;
  };

  for (const [date, samples] of groupByDay(heartRateSamples(data.heart_rate ?? []))) {
    const values = samples.map((s) => s.value);
    Object.assign(day(date), {
      avgHr: Math.round(avg(values)),
      minHr: min(values),
      maxHr: max(values),
      hrHourly: hourly(samples),
    });
  }

  // FC a riposo: un valore al giorno, vale l'ultimo
  const resting = samplesOf(data.resting_heart_rate ?? [], ["bpm", "value"], HR_RANGE, ["date_time", "time"]);
  for (const [date, samples] of groupByDay(resting)) {
    day(date).restingHr = Math.round(samples.sort((a, b) => a.time - b.time).at(-1)!.value);
  }

  // Passi a blocchi: si sommano
  for (const record of data.steps ?? []) {
    const p = parsePayload(record);
    const time = firstNum(p, "time") ?? num(record.time);
    if (time == null) continue;
    const d = day(localParts(time, zoneOffsetSeconds(record)).date);
    d.steps = (d.steps ?? 0) + Math.max(0, firstNum(p, "steps") ?? 0);
    d.distance = (d.distance ?? 0) + Math.max(0, firstNum(p, "distance") ?? 0);
    d.activeCalories = (d.activeCalories ?? 0) + Math.max(0, firstNum(p, "calories") ?? 0);
  }
  // Le calorie dedicate, se ci sono, sono più complete di quelle dei passi
  const calories = new Map<string, number>();
  for (const record of data.calories ?? []) {
    const p = parsePayload(record);
    const time = firstNum(p, "time") ?? num(record.time);
    if (time == null) continue;
    const date = localParts(time, zoneOffsetSeconds(record)).date;
    calories.set(date, (calories.get(date) ?? 0) + Math.max(0, firstNum(p, "calories") ?? 0));
  }
  for (const [date, kcal] of calories) day(date).activeCalories = kcal;

  for (const [date, samples] of groupByDay(samplesOf(data.spo2 ?? [], ["spo2", "value"], SPO2_RANGE))) {
    const values = samples.map((s) => s.value);
    Object.assign(day(date), { spo2Avg: round(avg(values), 1), spo2Min: min(values) });
  }

  for (const [date, samples] of groupByDay(samplesOf(data.stress ?? [], ["stress", "score", "value"], STRESS_RANGE))) {
    const values = samples.map((s) => s.value);
    Object.assign(day(date), { stressAvg: Math.round(avg(values)), stressMax: max(values) });
  }

  for (const d of days.values()) {
    if (d.distance != null) d.distance = Math.round(d.distance);
    if (d.activeCalories != null) d.activeCalories = Math.round(d.activeCalories);
  }
  return days;
}

/** Codici di fase dell'orologio (mi-fitness-mcp-cn); verificati con i totali per fase */
const DEFAULT_STAGES: Record<number, SleepStage> = { 1: "deep", 2: "light", 3: "light", 4: "awake", 5: "rem" };

/**
 * Se il riepilogo dà i minuti per fase, ogni codice va alla fase con il totale
 * più vicino: così l'ipnogramma resta giusto anche se Xiaomi cambia i codici.
 */
export function stageMapping(
  items: { state: number; minutes: number }[],
  totals: Partial<Record<SleepStage, number>>
): Record<number, SleepStage> {
  const byState = new Map<number, number>();
  for (const i of items) byState.set(i.state, (byState.get(i.state) ?? 0) + i.minutes);
  const known = (Object.entries(totals) as [SleepStage, number][]).filter(([, m]) => m > 0);
  if (known.length < 2 || byState.size < 2) return DEFAULT_STAGES;

  const mapping: Record<number, SleepStage> = {};
  const pairs = [...byState.entries()]
    .flatMap(([state, minutes]) => known.map(([stage, total]) => ({ state, stage, diff: Math.abs(minutes - total) })))
    .sort((a, b) => a.diff - b.diff);
  const usedStages = new Set<SleepStage>();
  for (const { state, stage } of pairs) {
    if (state in mapping || usedStages.has(stage)) continue;
    mapping[state] = stage;
    usedStages.add(stage);
  }
  // Codici in più (es. due codici "leggero"): restano quelli predefiniti
  for (const state of byState.keys()) mapping[state] ??= DEFAULT_STAGES[state] ?? "light";
  return mapping;
}

const minutesOf = (p: Payload, ...keys: string[]) => {
  const v = firstNum(p, ...keys);
  return v != null && v >= 0 ? Math.round(v) : null;
};

/** Registrazione del sonno → notte (null se incompleta) */
export function mapSleepRecord(record: FitnessRecord): SleepInput | null {
  const p = parsePayload(record);
  const start = firstNum(p, "bedtime", "device_bedtime", "bed_timestamp", "start_time");
  const end = firstNum(p, "wake_up_time", "device_wake_up_time", "out_bed_timestamp", "end_time") ?? num(record.time);
  if (!start || !end || end <= start) return null;
  const offset = zoneOffsetSeconds(record);

  const totals = {
    deep: minutesOf(p, "sleep_deep_duration", "deep_duration"),
    light: minutesOf(p, "sleep_light_duration", "light_duration"),
    rem: minutesOf(p, "sleep_rem_duration", "rem_duration"),
    awake: minutesOf(p, "sleep_awake_duration", "awake_duration"),
  };
  const items = (Array.isArray(p.items) ? p.items : [])
    .map((i: Payload) => ({ start: num(i?.start_time), end: num(i?.end_time), state: num(i?.state) }))
    .filter((i): i is { start: number; end: number; state: number } => i.start != null && i.end != null && i.state != null && i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const mapping = stageMapping(
    items.map((i) => ({ state: i.state, minutes: (i.end - i.start) / 60 })),
    Object.fromEntries(Object.entries(totals).filter(([, v]) => v != null)) as Partial<Record<SleepStage, number>>
  );
  const stages: SleepSegment[] = items.map((i) => ({ stage: mapping[i.state], start: i.start, end: i.end }));

  // Senza totali li ricava dall'ipnogramma
  const fromStages = (stage: SleepStage) =>
    stages.length ? Math.round(stages.filter((s) => s.stage === stage).reduce((sum, s) => sum + (s.end - s.start) / 60, 0)) : null;
  const deep = totals.deep ?? fromStages("deep");
  const light = totals.light ?? fromStages("light");
  const rem = totals.rem ?? fromStages("rem");
  const awake = totals.awake ?? fromStages("awake");

  const duration = minutesOf(p, "duration") ?? Math.round((end - start) / 60);
  const stageSum = (deep ?? 0) + (light ?? 0) + (rem ?? 0);
  const asleep = stageSum > 0 ? stageSum : Math.max(0, duration - (awake ?? 0));
  const startHour = localParts(start, offset).hour;
  // Pisolino: dichiarato, oppure breve e iniziato di giorno
  const isNap = p.is_nap === true || p.is_nap === 1 || (duration < 180 && startHour >= 9 && startHour < 20);
  const score = minutesOf(p, "sleep_score", "score");
  const avgHr = firstNum(p, "avg_hr", "avg_hrm");
  const minHr = firstNum(p, "min_hr", "min_hrm");
  const maxHr = firstNum(p, "max_hr", "max_hrm");
  const breath = firstNum(p, "avg_breath", "avg_respiration", "breath_rate");
  const awakeCount = minutesOf(p, "awake_count", "wake_count");

  return {
    externalId: `${record.sid ?? "watch"}|${start}`,
    date: localParts(end, offset).date,
    startAt: new Date(start * 1000),
    endAt: new Date(end * 1000),
    duration,
    asleep,
    deep,
    light,
    rem,
    awake,
    score: score || null,
    isNap,
    avgHr: avgHr && avgHr >= HR_RANGE[0] ? Math.round(avgHr) : null,
    minHr: minHr && minHr >= HR_RANGE[0] ? Math.round(minHr) : null,
    maxHr: maxHr && maxHr >= HR_RANGE[0] && maxHr <= HR_RANGE[1] ? Math.round(maxHr) : null,
    // Respiri al minuto plausibili nel sonno
    respRate: breath && breath >= 5 && breath <= 40 ? Math.round(breath * 10) / 10 : null,
    awakeCount,
    stages,
  };
}

/** FC media e minima tra due istanti (secondi), se ci sono abbastanza campioni */
export function heartRateBetween(samples: Sample[], from: number, to: number): { avgHr: number; minHr: number } | null {
  const values = samples.filter((s) => s.time >= from && s.time <= to).map((s) => s.value);
  if (values.length < 10) return null;
  return { avgHr: Math.round(avg(values)), minHr: min(values) };
}

/** FC media e minima durante il sonno, dai campioni al minuto se il riepilogo non le ha */
export function withSleepHeartRate(sleep: SleepInput, samples: Sample[]): SleepInput {
  if (sleep.avgHr && sleep.minHr) return sleep;
  const hr = heartRateBetween(samples, sleep.startAt.getTime() / 1000, sleep.endAt.getTime() / 1000);
  if (!hr) return sleep;
  return { ...sleep, avgHr: sleep.avgHr ?? hr.avgHr, minHr: sleep.minHr ?? hr.minHr };
}
