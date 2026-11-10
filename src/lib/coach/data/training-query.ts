import { calculateOneRM, isStrengthRepRange } from "@/lib/one-rm-calculator";
import { accumulateMuscleSets, getMuscleContributions, isWorkingSet, type MuscleSetTotals } from "@/lib/muscle-volume";
import { blockAt, blockKey, blocksInRange, type PlanBlock } from "./plan-blocks";
import { formatDayIt, localDayKey, monthKey, weekKey, type ResolvedPeriod } from "./periods";

/**
 * Risposte numeriche sugli allenamenti, calcolate in codice: il Coach sceglie
 * metrica, periodo e filtri, qui si fanno i conti. Funzioni pure, testate.
 */

export const TRAINING_METRICS = [
  "sessions",
  "sets",
  "reps",
  "volume_kg",
  "training_time",
  "max_weight",
  "e1rm",
  "run_distance",
  "run_time",
  "run_pace",
] as const;
export type TrainingMetric = (typeof TRAINING_METRICS)[number];

export const GROUP_BY = ["none", "week", "month", "plan", "exercise", "muscle"] as const;
export type GroupBy = (typeof GROUP_BY)[number];

export const ACTIVITY_KINDS = ["all", "gym", "run", "cardio"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface SetData {
  type: string | null;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface ExerciseData {
  exerciseId: string;
  name: string;
  primaryMuscle: string | null;
  muscleGroups: string[];
  muscleContributions: unknown;
  sets: SetData[];
}

export interface SessionData {
  id: string;
  startedAt: Date;
  kind: Exclude<ActivityKind, "all">;
  /** secondi */
  duration: number;
  exercises: ExerciseData[];
  run: { distance: number; movingTime: number } | null;
  /** distanza delle attività importate non di corsa (metri) */
  distance: number;
}

export interface TrainingQuery {
  metric: TrainingMetric;
  groupBy: GroupBy;
  activity: ActivityKind;
  muscles: string[];
  exerciseIds: string[];
}

interface Aggregate {
  sessions: number;
  directSets: number;
  indirectSets: number;
  weightedSets: number;
  reps: number;
  volumeKg: number;
  seconds: number;
  runMeters: number;
  runSeconds: number;
  runs: number;
  longestRunMeters: number;
  best: { value: number; weight: number; reps: number; day: string; exercise: string } | null;
  first: { value: number; day: string } | null;
  last: { value: number; day: string } | null;
}

const emptyAggregate = (): Aggregate => ({
  sessions: 0,
  directSets: 0,
  indirectSets: 0,
  weightedSets: 0,
  reps: 0,
  volumeKg: 0,
  seconds: 0,
  runMeters: 0,
  runSeconds: 0,
  runs: 0,
  longestRunMeters: 0,
  best: null,
  first: null,
  last: null,
});

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "5:12 /km" */
export function formatPace(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`;
}

/** Contributo dell'esercizio ai muscoli richiesti (tutti se il filtro è vuoto) */
function muscleTotals(exercise: ExerciseData, muscles: string[]): MuscleSetTotals | null {
  const working = exercise.sets.filter(isWorkingSet);
  if (working.length === 0) return null;
  if (muscles.length === 0) {
    const reps = working.reduce((s, x) => s + (x.reps ?? 0), 0);
    const tonnage = working.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0);
    return { directSets: working.length, indirectSets: 0, effectiveSets: working.length, tonnage, reps };
  }
  const byMuscle = accumulateMuscleSets({}, exercise, exercise.sets);
  const totals: MuscleSetTotals = { directSets: 0, indirectSets: 0, effectiveSets: 0, tonnage: 0, reps: 0 };
  const contributions = getMuscleContributions(exercise);
  let involved = false;
  for (const muscle of muscles) {
    const t = byMuscle[muscle];
    if (!t) continue;
    involved = true;
    totals.directSets += t.directSets;
    totals.indirectSets += t.indirectSets;
    // Serie pesate per contributo (senza il fattore RPE): indiretta = 0,5 o 0,25
    totals.effectiveSets += working.length * (contributions[muscle] ?? 0);
    totals.tonnage += t.tonnage;
    totals.reps += t.reps;
  }
  return involved ? totals : null;
}

const matchesKind = (session: SessionData, activity: ActivityKind) => activity === "all" || session.kind === activity;

/** Aggiunge una seduta all'aggregato; restituisce false se la seduta non è pertinente */
function addSession(agg: Aggregate, session: SessionData, query: TrainingQuery, exerciseFilter?: string): boolean {
  if (!matchesKind(session, query.activity)) return false;
  const day = localDayKey(session.startedAt);
  const exerciseIds = exerciseFilter ? [exerciseFilter] : query.exerciseIds;
  const filtersExercises = exerciseIds.length > 0 || query.muscles.length > 0;
  let relevant = !filtersExercises;

  for (const exercise of session.exercises) {
    if (exerciseIds.length > 0 && !exerciseIds.includes(exercise.exerciseId)) continue;
    const totals = muscleTotals(exercise, query.muscles);
    if (!totals) continue;
    relevant = true;
    agg.directSets += totals.directSets;
    agg.indirectSets += totals.indirectSets;
    agg.weightedSets += query.muscles.length > 0 ? totals.effectiveSets : totals.directSets;
    agg.reps += totals.reps;
    agg.volumeKg += totals.tonnage;

    if (query.metric === "max_weight" || query.metric === "e1rm") {
      const working = exercise.sets.filter(isWorkingSet);
      const candidate =
        query.metric === "e1rm"
          ? bestE1rm(working)
          : working.reduce<{ value: number; weight: number; reps: number } | null>((best, s) => {
              const w = s.weight ?? 0;
              return w > 0 && (!best || w > best.value) ? { value: w, weight: w, reps: s.reps ?? 0 } : best;
            }, null);
      if (candidate) {
        if (!agg.best || candidate.value > agg.best.value) agg.best = { ...candidate, day, exercise: exercise.name };
        if (!agg.first) agg.first = { value: candidate.value, day };
        agg.last = { value: candidate.value, day };
      }
    }
  }

  if (!filtersExercises && session.run) {
    agg.runs += 1;
    agg.runMeters += session.run.distance;
    agg.runSeconds += session.run.movingTime;
    agg.longestRunMeters = Math.max(agg.longestRunMeters, session.run.distance);
  }
  if (relevant) {
    agg.sessions += 1;
    agg.seconds += session.duration;
  }
  return relevant;
}

/** Massimale stimato migliore, con la serie da cui viene (stessa regola di one-rm-calculator) */
function bestE1rm(sets: SetData[]): { value: number; weight: number; reps: number } | null {
  const usable = sets.filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
  if (usable.length === 0) return null;
  const preferred = usable.filter((s) => isStrengthRepRange(s.reps));
  const pool = preferred.length > 0 ? preferred : usable;
  let best: { value: number; weight: number; reps: number } | null = null;
  for (const set of pool) {
    const value = calculateOneRM(set.weight!, set.reps!);
    if (!best || value > best.value) best = { value: round1(value), weight: set.weight!, reps: set.reps! };
  }
  return best;
}

/** Il valore della metrica richiesta, in una forma pronta da leggere */
function metricValue(agg: Aggregate, metric: TrainingMetric, weeks: number) {
  switch (metric) {
    case "sessions":
      return { value: agg.sessions, unit: "allenamenti", perWeek: round1(agg.sessions / weeks) };
    case "sets":
      return {
        value: round1(agg.weightedSets),
        unit: "serie",
        perWeek: round1(agg.weightedSets / weeks),
        directSets: agg.directSets,
        indirectSets: agg.indirectSets,
      };
    case "reps":
      return { value: Math.round(agg.reps), unit: "ripetizioni", perWeek: Math.round(agg.reps / weeks) };
    case "volume_kg":
      return { value: Math.round(agg.volumeKg), unit: "kg sollevati (peso × ripetizioni)", perWeek: Math.round(agg.volumeKg / weeks) };
    case "training_time":
      return { value: round1(agg.seconds / 3600), unit: "ore", perWeek: round1(agg.seconds / 3600 / weeks), sessions: agg.sessions };
    case "max_weight":
    case "e1rm":
      return {
        value: agg.best?.value ?? null,
        unit: metric === "e1rm" ? "kg (massimale stimato)" : "kg (serie più pesante)",
        best: agg.best ? { ...agg.best, day: formatDayIt(agg.best.day) } : null,
        firstInPeriod: agg.first ? { value: agg.first.value, day: formatDayIt(agg.first.day) } : null,
        lastInPeriod: agg.last ? { value: agg.last.value, day: formatDayIt(agg.last.day) } : null,
        change: agg.first && agg.last ? round1(agg.last.value - agg.first.value) : null,
      };
    case "run_distance":
      return {
        value: round1(agg.runMeters / 1000),
        unit: "km",
        perWeek: round1(agg.runMeters / 1000 / weeks),
        runs: agg.runs,
        longestRunKm: round1(agg.longestRunMeters / 1000),
      };
    case "run_time":
      return { value: round1(agg.runSeconds / 3600), unit: "ore di corsa", runs: agg.runs };
    case "run_pace":
      return {
        value: agg.runMeters > 0 ? formatPace(agg.runSeconds / (agg.runMeters / 1000)) : null,
        unit: "passo medio",
        runs: agg.runs,
        km: round1(agg.runMeters / 1000),
      };
  }
}

const WEEK_MS = 7 * 86_400_000;
const weeksBetween = (from: Date, to: Date) => Math.max((to.getTime() - from.getTime()) / WEEK_MS, 1 / 7);

export interface QueryContext {
  period: ResolvedPeriod;
  /** prima seduta registrata in assoluto (per non contare settimane prima dell'inizio) */
  firstActivity: Date | null;
  now: Date;
  blocks: PlanBlock[];
}

/**
 * Esegue la query sulle sedute già caricate per il periodo. Le sedute fuori
 * periodo vengono ignorate, così il caricamento può essere più largo.
 */
export function runTrainingQuery(sessions: SessionData[], query: TrainingQuery, ctx: QueryContext) {
  const { period } = ctx;
  const inPeriod = sessions
    .filter((s) => s.startedAt >= period.from && s.startedAt < period.to)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  // Le medie settimanali partono dalla prima seduta, non da prima dell'inizio
  const effectiveFrom = ctx.firstActivity && ctx.firstActivity > period.from ? ctx.firstActivity : period.from;
  const effectiveTo = period.to < ctx.now ? period.to : ctx.now;
  const weeks = weeksBetween(effectiveFrom, effectiveTo > effectiveFrom ? effectiveTo : period.to);

  const total = emptyAggregate();
  for (const s of inPeriod) addSession(total, s, query, undefined);

  const result: Record<string, unknown> = {
    period: { from: period.fromDay, to: period.toDay, label: period.label },
    metric: query.metric,
    ...metricValue(total, query.metric, weeks),
    weeksCounted: round1(weeks),
  };

  result.breakdown = breakdown(inPeriod, query, ctx);
  result.plans = planSplit(inPeriod, query, ctx, effectiveFrom, effectiveTo);
  result.coverage = coverage(inPeriod, ctx);
  result.definitions = definitions(query);
  return result;
}

function breakdown(sessions: SessionData[], query: TrainingQuery, ctx: QueryContext) {
  if (query.groupBy === "none" || query.groupBy === "plan") return undefined;

  if (query.groupBy === "exercise") {
    const ids = new Map<string, string>();
    for (const s of sessions) for (const e of s.exercises) ids.set(e.exerciseId, e.name);
    const rows = Array.from(ids.entries()).flatMap(([id, name]) => {
      if (query.exerciseIds.length > 0 && !query.exerciseIds.includes(id)) return [];
      const agg = emptyAggregate();
      for (const s of sessions) addSession(agg, s, query, id);
      if (agg.sessions === 0) return [];
      return [{ exerciseId: id, exercise: name, ...metricValue(agg, query.metric, 1), perWeek: undefined }];
    });
    return sortRows(rows).slice(0, 40);
  }

  if (query.groupBy === "muscle") {
    const muscles = new Set<string>();
    for (const s of sessions) for (const e of s.exercises) Object.keys(getMuscleContributions(e)).forEach((m) => muscles.add(m));
    const wanted = query.muscles.length > 0 ? query.muscles : Array.from(muscles);
    const rows = wanted.map((muscle) => {
      const agg = emptyAggregate();
      for (const s of sessions) addSession(agg, s, { ...query, muscles: [muscle] }, undefined);
      return { muscle, ...metricValue(agg, query.metric, 1), perWeek: undefined };
    });
    return sortRows(rows);
  }

  // Settimana o mese: serie temporale (anche i periodi vuoti, per i grafici)
  const keyOf = query.groupBy === "week" ? weekKey : monthKey;
  const buckets = new Map<string, Aggregate>();
  for (const key of timeKeys(ctx.period, query.groupBy)) buckets.set(key, emptyAggregate());
  for (const s of sessions) {
    const key = keyOf(s.startedAt);
    if (!buckets.has(key)) buckets.set(key, emptyAggregate());
    addSession(buckets.get(key)!, s, query, undefined);
  }
  return Array.from(buckets.entries())
    .slice(-60)
    .map(([key, agg]) => {
      const value = metricValue(agg, query.metric, 1);
      return { [query.groupBy]: key, value: value.value, plan: blockAt(ctx.blocks, parseKey(key))?.name ?? null };
    });
}

const parseKey = (key: string) => new Date(`${key.length === 7 ? `${key}-01` : key}T12:00:00Z`);

/** Tutte le settimane/mesi del periodo (al massimo ~5 anni) */
function timeKeys(period: ResolvedPeriod, groupBy: "week" | "month"): string[] {
  const keys: string[] = [];
  const keyOf = groupBy === "week" ? weekKey : monthKey;
  const step = groupBy === "week" ? WEEK_MS : 86_400_000;
  for (let t = period.from.getTime(); t < period.to.getTime() && keys.length < 400; t += step) {
    const key = keyOf(new Date(t));
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

const numericValue = (row: { value: unknown }) => (typeof row.value === "number" ? row.value : -1);
const sortRows = <T extends { value: unknown }>(rows: T[]) => [...rows].sort((a, b) => numericValue(b) - numericValue(a));

/**
 * Il periodo diviso per piano seguito. Se il periodo tocca più piani il Coach
 * deve dirlo e confrontare le medie settimanali, non i totali.
 */
function planSplit(sessions: SessionData[], query: TrainingQuery, ctx: QueryContext, from: Date, to: Date) {
  const blocks = blocksInRange(ctx.blocks, ctx.period.from, ctx.period.to);
  const rows = blocks.map((block) => {
    const start = block.from > from ? block.from : from;
    const end = block.to && block.to < to ? block.to : to;
    const agg = emptyAggregate();
    for (const s of sessions) {
      const owner = blockAt(ctx.blocks, s.startedAt);
      if (s.startedAt >= start && s.startedAt < end && owner && blockKey(owner) === blockKey(block)) {
        addSession(agg, s, query, undefined);
      }
    }
    const weeks = weeksBetween(start, end > start ? end : start);
    return {
      plan: block.name,
      current: block.current,
      from: formatDayIt(localDayKey(start)),
      to: end >= ctx.now ? "oggi" : formatDayIt(localDayKey(new Date(end.getTime() - 1))),
      weeks: round1(weeks),
      ...metricValue(agg, query.metric, weeks),
      exercisePresent: query.exerciseIds.length > 0 ? agg.sessions > 0 : undefined,
    };
  });

  return {
    count: rows.length,
    changedPlanInPeriod: rows.length > 1,
    note:
      rows.length > 1
        ? "Il periodo comprende piani diversi: dillo chiaramente e confronta le medie settimanali di ciascun piano, non i totali. Se un esercizio manca in un piano, non è confrontabile in quel piano."
        : undefined,
    blocks: rows,
  };
}

function coverage(sessions: SessionData[], ctx: QueryContext) {
  const gymWithoutSets = sessions.filter((s) => s.kind === "gym" && s.exercises.every((e) => e.sets.length === 0)).length;
  return {
    sessionsInPeriod: sessions.length,
    firstEverSession: ctx.firstActivity ? formatDayIt(localDayKey(ctx.firstActivity)) : null,
    gymSessionsWithoutSets: gymWithoutSets,
    note: gymWithoutSets > 0 ? `${gymWithoutSets} sedute di palestra senza serie registrate (importate dall'orologio): non entrano nei conteggi di serie, ripetizioni e volume.` : undefined,
  };
}

function definitions(query: TrainingQuery): string {
  const parts = ["Serie di riscaldamento sempre escluse.", `Fuso orario: Europa/Roma.`];
  if (query.metric === "sets" && query.muscles.length > 0) {
    parts.push(
      "Serie per muscolo: 'directSets' sono le serie di esercizi in cui il muscolo è il principale; 'indirectSets' quelle in cui lavora come secondario. 'value' somma le dirette per intero e le indirette pesate (0,5 il secondario principale, 0,25 gli altri)."
    );
  }
  if (query.metric === "e1rm") parts.push("Massimale stimato con la formula di Epley, preferendo le serie da 1 a 8 ripetizioni.");
  if (query.metric === "volume_kg") {
    parts.push("Volume = peso × ripetizioni delle serie di lavoro.");
    if (query.muscles.length > 0) parts.push("Per muscolo il volume degli esercizi in cui lavora come secondario è pesato (0,5 o 0,25).");
  }
  if (query.metric === "sessions" && (query.muscles.length > 0 || query.exerciseIds.length > 0)) {
    parts.push("Contano solo le sedute che contengono il muscolo o l'esercizio richiesto.");
  }
  return parts.join(" ");
}
