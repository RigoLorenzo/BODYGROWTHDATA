import type { ExternalWorkoutInput } from "@/lib/activities/repository";
import type { RunInput } from "@/lib/run/repository";
import { hourlyHeartRate, type HeartSample, type HourOf } from "@/lib/wellness/heart";
import type { DaySummary, SleepInput, SleepSegment, SleepStage } from "@/lib/wellness/types";
import type { GarminActivity, GarminDailyHeartRate, GarminDailySummary, GarminSleep, GarminTime } from "./client";

/** Dati della Garmin Personal API → modelli dell'app. Funzioni pure. */

const num = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const positive = (v: unknown) => {
  const n = num(v);
  return n != null && n > 0 ? n : null;
};
const inRange = (v: unknown, [lo, hi]: [number, number]) => {
  const n = num(v);
  return n != null && n >= lo && n <= hi ? Math.round(n) : undefined;
};

const HR_RANGE: [number, number] = [25, 230];
const SPO2_RANGE: [number, number] = [70, 100];
/** Lo stress Garmin va da 0 a 100; -1 e -2 indicano "nessun dato" */
const STRESS_RANGE: [number, number] = [1, 100];

/** Istante Garmin in millisecondi; i testi senza fuso sono UTC */
export function garminTime(value: GarminTime): number | null {
  if (value == null) return null;
  if (typeof value === "object") return garminTime(value.date);
  const n = num(value);
  if (n != null || typeof value !== "string") return n;
  const iso = value.trim().replace(" ", "T");
  const ms = Date.parse(/([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(ms) ? ms : null;
}

// ─── Attività ────────────────────────────────────────────────────────────────

/** typeId 1 = running, padre di trail, tapis roulant, pista… */
const RUNNING_TYPE_ID = 1;

export function isRun(type: GarminActivity["activityType"]): boolean {
  if (!type) return false;
  return type.typeId === RUNNING_TYPE_ID || type.parentTypeId === RUNNING_TYPE_ID || /run/i.test(type.typeKey ?? "");
}

function sportTypeOf(typeKey: string): string {
  if (/treadmill|indoor/i.test(typeKey)) return "Treadmill";
  if (/trail/i.test(typeKey)) return "TrailRun";
  return "Run";
}

/** Attività Garmin → corsa (null se non è una corsa o mancano i dati base) */
export function mapActivity(activity: GarminActivity): RunInput | null {
  if (!isRun(activity.activityType)) return null;
  const startMs = garminTime(activity.startTimeGMT);
  const distance = positive(activity.distance);
  const duration = positive(activity.duration) ?? positive(activity.elapsedDuration);
  if (activity.activityId == null || startMs == null || !distance || !duration) return null;

  const sportType = sportTypeOf(activity.activityType?.typeKey ?? "");
  const elapsed = positive(activity.elapsedDuration) ?? duration;
  const moving = Math.min(positive(activity.movingDuration) ?? duration, elapsed);
  const name = activity.activityName?.trim() || (sportType === "Treadmill" ? "Corsa su tapis roulant" : "Corsa");
  return {
    source: "GARMIN",
    externalId: String(activity.activityId),
    name,
    // Il nome viene da Garmin: uno cambiato nell'app non va sovrascritto
    generatedName: true,
    sportType,
    startedAt: new Date(startMs),
    distance: Math.round(distance),
    movingTime: Math.round(moving),
    elapsedTime: Math.round(elapsed),
    elevationGain: num(activity.elevationGain),
    avgHeartRate: positive(activity.averageHR),
    maxHeartRate: positive(activity.maxHR),
    avgCadence: positive(activity.averageRunningCadenceInStepsPerMinute)
      ? Math.round(activity.averageRunningCadenceInStepsPerMinute!)
      : null,
    calories: positive(activity.calories),
    // Senza GPS (tapis roulant, indoor) non c'è percorso da scaricare
    detailed: sportType === "Treadmill" || activity.hasPolyline === false,
  };
}

// ─── Altre attività: palestra, bici, camminate… ──────────────────────────────

/** Tipi Garmin (typeKey) → tipo dell'app e nome italiano di riserva */
const OTHER_TYPES: [RegExp, { sportType: string; label: string }][] = [
  [/indoor_cycling|virtual_ride/, { sportType: "IndoorRide", label: "Bici indoor" }],
  [/cycling|biking|bmx|gravel|e_bike|ride/, { sportType: "Ride", label: "Giro in bici" }],
  [/walking/, { sportType: "Walk", label: "Camminata" }],
  [/hiking|mountaineering/, { sportType: "Hike", label: "Escursione" }],
  [/swimming/, { sportType: "Swim", label: "Nuoto" }],
  [/rowing/, { sportType: "Row", label: "Vogatore" }],
  [/elliptical/, { sportType: "Elliptical", label: "Ellittica" }],
  [/stair/, { sportType: "StairStepper", label: "Scale" }],
  [/yoga/, { sportType: "Yoga", label: "Yoga" }],
  [/pilates/, { sportType: "Pilates", label: "Pilates" }],
  [/hiit|cardio|boxing|crossfit/, { sportType: "Workout", label: "Allenamento cardio" }],
];

export const isStrength = (type: GarminActivity["activityType"]) => /strength/i.test(type?.typeKey ?? "");

function otherType(typeKey: string) {
  for (const [pattern, type] of OTHER_TYPES) if (pattern.test(typeKey)) return type;
  const label = typeKey ? typeKey.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Attività";
  return { sportType: "Workout", label };
}

/** Palestra (con gli esercizi registrati) o altra attività; null per le corse e i dati incompleti */
export function mapOtherActivity(activity: GarminActivity): ExternalWorkoutInput | null {
  if (isRun(activity.activityType)) return null;
  const startMs = garminTime(activity.startTimeGMT);
  const duration = positive(activity.elapsedDuration) ?? positive(activity.duration);
  if (activity.activityId == null || startMs == null || !duration) return null;

  const typeKey = activity.activityType?.typeKey ?? "";
  const strength = isStrength(activity.activityType);
  const type = strength ? { sportType: "Strength", label: "Allenamento di forza" } : otherType(typeKey);
  const exercises = strength
    ? (activity.summarizedExerciseSets ?? [])
        .filter((e) => (num(e.sets) ?? 0) > 0)
        .map((e) => ({
          category: e.category ?? null,
          subCategory: e.subCategory ?? null,
          sets: Math.round(num(e.sets) ?? 0),
          reps: Math.round(num(e.reps) ?? 0),
          // Garmin dà grammi
          volumeKg: (num(e.volume) ?? 0) / 1000,
          maxWeightKg: positive(e.maxWeight) != null ? positive(e.maxWeight)! / 1000 : null,
        }))
    : undefined;

  return {
    source: "GARMIN",
    externalId: String(activity.activityId),
    kind: strength ? "strength" : "cardio",
    title: activity.activityName?.trim() || type.label,
    sportType: type.sportType,
    startedAt: new Date(startMs),
    duration: Math.round(duration),
    distance: positive(activity.distance),
    avgHeartRate: positive(activity.averageHR),
    maxHeartRate: positive(activity.maxHR),
    calories: positive(activity.calories),
    exercises,
  };
}

// ─── Riepilogo del giorno ────────────────────────────────────────────────────

export function mapDailySummary(summary: GarminDailySummary): DaySummary | null {
  const date = summary.calendarDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || summary.includesWellnessData === false) return null;
  const steps = summary.movement?.steps;
  const stepsValue = typeof steps === "number" ? steps : steps?.value;
  const day: DaySummary = { date };
  const set = <K extends keyof DaySummary>(key: K, value: DaySummary[K] | undefined) => {
    if (value != null) day[key] = value;
  };
  set("steps", inRange(stepsValue, [0, 200_000]));
  set("distance", typeof steps === "object" ? inRange(steps?.distanceInMeters, [0, 500_000]) : undefined);
  set("activeCalories", inRange(summary.calories?.burnedActive, [0, 20_000]));
  set("restingHr", inRange(summary.heartRate?.restingValue, HR_RANGE));
  set("minHr", inRange(summary.heartRate?.minValue, HR_RANGE));
  set("maxHr", inRange(summary.heartRate?.maxValue, HR_RANGE));
  set("stressAvg", inRange(summary.stress?.avgLevel, STRESS_RANGE));
  set("stressMax", inRange(summary.stress?.maxLevel, STRESS_RANGE));
  set("spo2Avg", inRange(summary.pulseOx?.avgValue, SPO2_RANGE));
  set("spo2Min", inRange(summary.pulseOx?.minValue, SPO2_RANGE));
  return day;
}

// ─── Sonno ───────────────────────────────────────────────────────────────────

const minutes = (seconds: unknown) => {
  const n = num(seconds);
  return n != null && n >= 0 ? Math.round(n / 60) : null;
};

const LEVEL_STAGE: Record<number, SleepStage> = { 0: "deep", 1: "light", 2: "rem", 3: "awake" };

/** Ipnogramma dalle fasi minuto per minuto, se Garmin le invia */
export function sleepStages(sleep: GarminSleep): SleepSegment[] {
  const stages: SleepSegment[] = [];
  for (const level of sleep.sleepLevels ?? []) {
    const start = garminTime(level?.startGMT);
    const end = garminTime(level?.endGMT);
    const stage = LEVEL_STAGE[Math.round(num(level?.activityLevel) ?? -1)];
    if (start == null || end == null || end <= start || !stage) continue;
    if (stage === "rem" && sleep.deviceRemCapable === false) continue;
    stages.push({ stage, start: Math.round(start / 1000), end: Math.round(end / 1000) });
  }
  return stages.sort((a, b) => a.start - b.start);
}

function mainSleep(sleep: GarminSleep): SleepInput | null {
  const start = garminTime(sleep.sleepStartTimestampGMT);
  const end = garminTime(sleep.sleepEndTimestampGMT);
  const asleep = minutes(sleep.sleepTimeSeconds);
  if (!sleep.calendarDate || start == null || end == null || end <= start || !asleep) return null;
  const respRate = num(sleep.averageRespirationValue);
  return {
    externalId: `garmin|${sleep.id ?? sleep.calendarDate}`,
    date: sleep.calendarDate,
    startAt: new Date(start),
    endAt: new Date(end),
    duration: Math.round((end - start) / 60_000),
    asleep,
    deep: minutes(sleep.deepSleepSeconds),
    light: minutes(sleep.lightSleepSeconds),
    // Senza rilevamento REM lo 0 non è una misura: il punteggio non deve penalizzarlo
    rem: sleep.deviceRemCapable === false ? null : minutes(sleep.remSleepSeconds),
    awake: minutes(sleep.awakeSleepSeconds),
    score: inRange(sleep.sleepScores?.overall?.value, [1, 100]) ?? null,
    isNap: false,
    avgHr: inRange(sleep.avgHeartRate, HR_RANGE) ?? null,
    minHr: null,
    maxHr: null,
    respRate: respRate != null && respRate >= 5 && respRate <= 40 ? Math.round(respRate * 10) / 10 : null,
    awakeCount: inRange(sleep.awakeCount, [0, 200]) ?? null,
    // La Personal API documenta solo i totali per fase: l'ipnogramma c'è solo se Garmin lo invia
    stages: sleepStages(sleep),
  };
}

function naps(sleep: GarminSleep): SleepInput[] {
  const out: SleepInput[] = [];
  for (const nap of sleep.dailyNapDTOS ?? []) {
    const start = garminTime(nap.napStartTimestampGMT);
    const end = garminTime(nap.napEndTimestampGMT);
    const date = nap.calendarDate ?? sleep.calendarDate;
    if (start == null || end == null || end <= start || !date) continue;
    const duration = Math.round((end - start) / 60_000);
    out.push({
      externalId: `garmin-nap|${start}`,
      date,
      startAt: new Date(start),
      endAt: new Date(end),
      duration,
      asleep: minutes(nap.napTimeSec) ?? duration,
      deep: null,
      light: null,
      rem: null,
      awake: null,
      score: null,
      isNap: true,
      avgHr: null,
      minHr: null,
      maxHr: null,
      respRate: null,
      awakeCount: null,
      stages: [],
    });
  }
  return out;
}

/** Notte del giorno (data del risveglio) e pisolini */
export function mapSleep(sleep: GarminSleep): SleepInput[] {
  const night = mainSleep(sleep);
  return [...(night ? [night] : []), ...naps(sleep)];
}

// ─── Battiti al minuto ───────────────────────────────────────────────────────

const localDate = (value: GarminDailyHeartRate["calendarDate"]) =>
  typeof value === "string" ? value : (value?.localDate ?? null);

/** Campioni validi (secondi epoch); le colonne sono descritte da heartRateValueDescriptors */
export function heartSamples(day: GarminDailyHeartRate): HeartSample[] {
  const columns = new Map((day.heartRateValueDescriptors ?? []).map((d) => [d.key, d.index]));
  const timeAt = columns.get("timestamp") ?? 0;
  const bpmAt = columns.get("heartrate") ?? 1;
  const samples: HeartSample[] = [];
  for (const row of day.heartRateValues ?? []) {
    if (!Array.isArray(row)) continue;
    const ms = garminTime(row[timeAt] as GarminTime);
    const bpm = num(row[bpmAt]);
    if (ms == null || bpm == null || bpm < HR_RANGE[0] || bpm > HR_RANGE[1]) continue;
    samples.push({ time: Math.round(ms / 1000), value: bpm });
  }
  return samples.sort((a, b) => a.time - b.time);
}

/** Scostamento del giorno da UTC (secondi), dai timestamp locale e GMT */
export function dayOffset(day: GarminDailyHeartRate): number | null {
  const local = garminTime(day.startTimestampLocal);
  const gmt = garminTime(day.startTimestampGMT);
  if (local == null || gmt == null || typeof day.startTimestampLocal === "object") return null;
  const offset = Math.round((local - gmt) / 1000);
  return Math.abs(offset) <= 14 * 3600 ? offset : null;
}

/** Media, minimo, massimo, FC a riposo e curva oraria del giorno */
export function mapDailyHeartRate(day: GarminDailyHeartRate, hourOf: HourOf): { summary: DaySummary; samples: HeartSample[] } | null {
  const date = localDate(day.calendarDate);
  if (!date) return null;
  const samples = heartSamples(day);
  const summary: DaySummary = { date };
  const resting = inRange(day.restingHeartRate, HR_RANGE);
  if (resting != null) summary.restingHr = resting;
  if (samples.length) {
    const values = samples.map((s) => s.value);
    summary.avgHr = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    summary.minHr = Math.min(...values);
    summary.maxHr = Math.max(...values);
    summary.hrHourly = hourlyHeartRate(samples, hourOf);
  } else {
    const min = inRange(day.minHeartRate, HR_RANGE);
    const max = inRange(day.maxHeartRate, HR_RANGE);
    if (min != null) summary.minHr = min;
    if (max != null) summary.maxHr = max;
  }
  return { summary, samples };
}
