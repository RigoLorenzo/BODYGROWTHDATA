/**
 * Dati della scheda condivisibile di un allenamento (stile Strava).
 *
 * Logica pura, senza database né rendering: riceve la seduta già caricata e
 * restituisce numeri e testi pronti da impaginare nell'immagine.
 * Le serie di riscaldamento non contano, come nel resto dell'app.
 */

import { getMuscleColor, getMuscleLabel } from "./utils";

export interface ShareSetLike {
  type?: string | null;
  weight?: number | null;
  reps?: number | null;
  duration?: number | null;
}

export interface ShareExerciseLike {
  exercise: { name: string; nameIt?: string | null; primaryMuscle?: string | null } | null;
  sets: ShareSetLike[];
}

export interface SharePersonalRecordLike {
  recordType: string;
  value: number;
  improvementPercent?: number | null;
  exercise: { name: string } | null;
}

export interface ShareWorkoutLike {
  startedAt: Date | string;
  endedAt?: Date | string | null;
  duration?: number | null;
  exercises: ShareExerciseLike[];
  personalRecords?: SharePersonalRecordLike[];
}

export interface ShareMuscle {
  muscle: string;
  label: string;
  color: string;
  sets: number;
  /** Quota delle serie totali, da 0 a 1 */
  share: number;
}

export interface ShareExercise {
  name: string;
  color: string;
  /** Es. "4 × 8 · 100 kg" oppure "4 serie · top 100 kg × 6" */
  summary: string;
  pr: string | null;
}

export interface ShareRecord {
  exerciseName: string;
  label: string;
}

export interface WorkoutShareStats {
  tonnage: number;
  workingSets: number;
  reps: number;
  exerciseCount: number;
  durationSeconds: number | null;
  topSet: { exerciseName: string; weight: number; reps: number } | null;
  muscles: ShareMuscle[];
  exercises: ShareExercise[];
  records: ShareRecord[];
}

const isWorking = (set: ShareSetLike) => (set.type ?? "WORKING") !== "WARMUP";

const setTonnage = (set: ShareSetLike) => (set.weight ?? 0) * (set.reps ?? 0);

/** 82,5 · 1.250 — decimali e migliaia all'italiana */
export function formatNumberIt(value: number, decimals = 0): string {
  const fixed = value.toFixed(decimals).replace(/\.0+$/, "");
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec ? `${grouped},${dec}` : grouped;
}

export const formatKg = (kg: number) => `${formatNumberIt(kg, 1)} kg`;

/** Tonnellaggio diviso in valore e unità, per impaginarli con pesi diversi */
export function splitTonnage(kg: number): { value: string; unit: string } {
  // In tonnellate il decimale resta sempre: "6,0 t" si legge meglio di "6 t"
  if (kg >= 1000) return { value: (kg / 1000).toFixed(1).replace(".", ","), unit: "t" };
  return { value: formatNumberIt(kg), unit: "kg" };
}

/** 1h 12m · 48 min */
export function formatShareDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function workoutDurationSeconds(workout: ShareWorkoutLike): number | null {
  if (workout.duration && workout.duration > 0) return workout.duration;
  if (!workout.endedAt) return null;
  const diff = (new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime()) / 1000;
  return diff > 0 ? Math.round(diff) : null;
}

export const DEFAULT_TIME_ZONE = "Europe/Rome";

/** Fuso orario valido per Intl, altrimenti quello di default */
export function safeTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("it-IT", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Data e ora nel fuso di chi condivide: il server gira in UTC, quindi
 * senza fuso un allenamento serale risulterebbe pomeridiano.
 */
export function zonedDateParts(date: Date | string, timeZone: string) {
  const when = new Date(date);
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(when);
  const timeLabel = new Intl.DateTimeFormat("it-IT", { timeZone, hour: "2-digit", minute: "2-digit" }).format(when);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(when));
  return { dateLabel, timeLabel, hour };
}

/** Titolo di riserva alla Strava: "Allenamento serale" */
export function timeOfDayTitle(hour: number): string {
  if (hour >= 5 && hour < 12) return "Allenamento mattutino";
  if (hour >= 12 && hour < 18) return "Allenamento pomeridiano";
  if (hour >= 18 && hour < 23) return "Allenamento serale";
  return "Allenamento notturno";
}

function summarizeSets(sets: ShareSetLike[]): string {
  const count = sets.length;
  const weights = sets.map((s) => s.weight ?? 0);
  const reps = sets.map((s) => s.reps ?? 0);
  const maxWeight = Math.max(...weights);
  const maxReps = Math.max(...reps);
  const uniform = (values: number[]) => values.every((v) => v === values[0]);

  if (maxReps === 0) {
    const maxDuration = Math.max(...sets.map((s) => s.duration ?? 0));
    return maxDuration > 0 ? `${count} × ${maxDuration}s` : `${count} serie`;
  }
  if (maxWeight === 0) {
    return uniform(reps) ? `${count} × ${maxReps}` : `${count} serie · max ${maxReps} rip.`;
  }
  if (uniform(weights)) {
    const minReps = Math.min(...reps);
    const repsLabel = minReps === maxReps ? `${maxReps}` : `${minReps}-${maxReps}`;
    return `${count} × ${repsLabel} · ${formatKg(maxWeight)}`;
  }

  // Serie top: il carico più alto, a parità di carico più ripetizioni
  const top = sets.reduce((best, s) =>
    (s.weight ?? 0) > (best.weight ?? 0) ||
    ((s.weight ?? 0) === (best.weight ?? 0) && (s.reps ?? 0) > (best.reps ?? 0))
      ? s
      : best
  );
  return `${count} serie · top ${formatKg(top.weight ?? 0)} × ${top.reps ?? 0}`;
}

// Il record più parlante per esercizio: carico prima del 1RM stimato, poi volume e ripetizioni
const RECORD_PRIORITY = ["WEIGHT", "ONE_RM", "VOLUME", "REPS"];

function recordLabel(record: SharePersonalRecordLike): string {
  switch (record.recordType) {
    case "WEIGHT":
      return `${formatKg(record.value)}`;
    case "ONE_RM":
      return `1RM ${formatKg(record.value)}`;
    case "VOLUME":
      return `Volume ${formatKg(record.value)}`;
    case "REPS":
      return `${formatNumberIt(record.value)} rip.`;
    default:
      return formatNumberIt(record.value, 1);
  }
}

export function bestRecordsByExercise(records: SharePersonalRecordLike[]): Map<string, ShareRecord> {
  const rank = (type: string) => {
    const index = RECORD_PRIORITY.indexOf(type);
    return index === -1 ? RECORD_PRIORITY.length : index;
  };
  const best = new Map<string, SharePersonalRecordLike>();
  for (const record of records) {
    const name = record.exercise?.name;
    if (!name) continue;
    const current = best.get(name);
    if (!current || rank(record.recordType) < rank(current.recordType)) best.set(name, record);
  }
  return new Map(
    Array.from(best.entries()).map(([name, record]) => [name, { exerciseName: name, label: recordLabel(record) }])
  );
}

function aggregateMuscles(exercises: { muscle: string; sets: number }[]): ShareMuscle[] {
  const totals = new Map<string, number>();
  for (const { muscle, sets } of exercises) totals.set(muscle, (totals.get(muscle) ?? 0) + sets);
  const all = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
  return Array.from(totals.entries())
    .filter(([, sets]) => sets > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, sets]) => ({
      muscle,
      label: getMuscleLabel(muscle),
      color: getMuscleColor(muscle),
      sets,
      share: all > 0 ? sets / all : 0,
    }));
}

export function buildWorkoutShareStats(workout: ShareWorkoutLike): WorkoutShareStats {
  const records = bestRecordsByExercise(workout.personalRecords ?? []);
  const performed = workout.exercises
    .map((ex) => ({
      name: ex.exercise?.name ?? "Esercizio",
      muscle: ex.exercise?.primaryMuscle ?? "FULL_BODY",
      sets: ex.sets.filter(isWorking),
    }))
    .filter((ex) => ex.sets.length > 0);

  let topSet: WorkoutShareStats["topSet"] = null;
  for (const ex of performed) {
    for (const set of ex.sets) {
      const weight = set.weight ?? 0;
      const reps = set.reps ?? 0;
      if (weight <= 0 || reps <= 0) continue;
      if (!topSet || weight > topSet.weight || (weight === topSet.weight && reps > topSet.reps)) {
        topSet = { exerciseName: ex.name, weight, reps };
      }
    }
  }

  const tonnage = performed.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + setTonnage(set), 0), 0);

  return {
    tonnage,
    workingSets: performed.reduce((sum, ex) => sum + ex.sets.length, 0),
    reps: performed.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps ?? 0), 0), 0),
    exerciseCount: performed.length,
    durationSeconds: workoutDurationSeconds(workout),
    topSet,
    muscles: aggregateMuscles(performed.map((ex) => ({ muscle: ex.muscle, sets: ex.sets.length }))),
    exercises: performed.map((ex) => ({
      name: ex.name,
      color: getMuscleColor(ex.muscle),
      summary: summarizeSets(ex.sets),
      pr: records.get(ex.name)?.label ?? null,
    })),
    records: Array.from(records.values()),
  };
}
