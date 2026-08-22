/**
 * Muscle Volume: le serie di lavoro attribuite ai singoli muscoli.
 *
 * Da tenere distinto dal Volume Load (peso × ripetizioni), che misura il
 * tonnellaggio movimentato: per capire quanto lavoro riceve un muscolo si
 * contano le serie, non i chilogrammi.
 *
 * Ogni esercizio distribuisce ogni sua serie di lavoro sui muscoli coinvolti
 * con un coefficiente di contributo (modello di scoring, non una percentuale
 * fisiologica): primario 1.0, secondario 0.5, terziario 0.25.
 * Esempio: Bench Press → Chest 1.0, Triceps 0.5, Shoulders 0.25.
 */

export const PRIMARY_CONTRIBUTION = 1;
export const SECONDARY_CONTRIBUTION = 0.5;
export const TERTIARY_CONTRIBUTION = 0.25;

/** Coefficiente per muscolo, es. { CHEST: 1, TRICEPS: 0.5, SHOULDERS: 0.25 } */
export type MuscleContributions = Record<string, number>;

export interface ExerciseLike {
  primaryMuscle?: string | null;
  muscleGroups?: string[] | null;
  /** Override configurabile per esercizio (Exercise.muscleContributions) */
  muscleContributions?: unknown;
}

export interface WorkingSetLike {
  type?: string | null;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

export interface MuscleSetTotals {
  /** Serie su esercizi in cui il muscolo è il primario */
  directSets: number;
  /** Serie su esercizi in cui il muscolo è coinvolto ma non primario */
  indirectSets: number;
  /** Serie pesate per contributo e vicinanza al cedimento */
  effectiveSets: number;
  /** Volume Load attribuito al muscolo (statistica separata) */
  tonnage: number;
  reps: number;
}

const isContributionMap = (value: unknown): value is MuscleContributions =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.values(value as Record<string, unknown>).every(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0
  );

/**
 * Coefficienti dell'esercizio: se non è configurato nulla si derivano dai dati
 * già presenti (muscolo primario + ordine di `muscleGroups`), così anche gli
 * allenamenti e gli esercizi già salvati funzionano senza modifiche.
 */
export function getMuscleContributions(exercise: ExerciseLike): MuscleContributions {
  if (isContributionMap(exercise.muscleContributions)) {
    return exercise.muscleContributions;
  }

  const contributions: MuscleContributions = {};
  const primary = exercise.primaryMuscle ?? undefined;
  if (primary) contributions[primary] = PRIMARY_CONTRIBUTION;

  const groups = (exercise.muscleGroups ?? []).filter((m) => m && m !== primary);
  groups.forEach((muscle, index) => {
    // Il primo secondario pesa più del terzo: l'ordine della libreria è
    // dal muscolo più coinvolto al meno coinvolto.
    const value = index === 0 ? SECONDARY_CONTRIBUTION : TERTIARY_CONTRIBUTION;
    contributions[muscle] = Math.max(contributions[muscle] ?? 0, value);
  });

  return contributions;
}

/** Una serie conta come lavoro se non è di riscaldamento */
export const isWorkingSet = (set: WorkingSetLike): boolean => (set.type ?? "WORKING") !== "WARMUP";

/**
 * Qualità della serie in base alla vicinanza al cedimento (RIR = 10 − RPE).
 * Senza RPE la serie vale piena: i dati mancanti non penalizzano.
 */
export function setQualityFactor(rpe?: number | null): number {
  if (rpe == null || !Number.isFinite(rpe)) return 1;
  if (rpe >= 8) return 1; // 0-2 ripetizioni dal cedimento
  if (rpe >= 7) return 0.85; // ~3 RIR
  if (rpe >= 6) return 0.7; // ~4 RIR
  return 0.5; // lontano dal cedimento
}

const emptyTotals = (): MuscleSetTotals => ({
  directSets: 0,
  indirectSets: 0,
  effectiveSets: 0,
  tonnage: 0,
  reps: 0,
});

/**
 * Distribuisce le serie di un esercizio sui muscoli coinvolti,
 * accumulando dentro `into` (che può già contenere altri esercizi).
 */
export function accumulateMuscleSets(
  into: Record<string, MuscleSetTotals>,
  exercise: ExerciseLike,
  sets: WorkingSetLike[]
): Record<string, MuscleSetTotals> {
  const contributions = getMuscleContributions(exercise);
  const working = sets.filter(isWorkingSet);
  if (working.length === 0) return into;

  for (const [muscle, coefficient] of Object.entries(contributions)) {
    if (!into[muscle]) into[muscle] = emptyTotals();
    const totals = into[muscle];

    for (const set of working) {
      if (coefficient >= PRIMARY_CONTRIBUTION) totals.directSets += 1;
      else totals.indirectSets += 1;

      totals.effectiveSets += coefficient * setQualityFactor(set.rpe);
      totals.tonnage += (set.weight ?? 0) * (set.reps ?? 0) * coefficient;
      totals.reps += (set.reps ?? 0) * coefficient;
    }
  }

  return into;
}

/** Totale delle serie di lavoro (indipendente dal muscolo) */
export function countWorkingSets(sets: WorkingSetLike[]): number {
  return sets.filter(isWorkingSet).length;
}

/** Serie efficaci totali: contributo pieno una volta sola per serie */
export function countEffectiveSets(sets: WorkingSetLike[]): number {
  return sets.filter(isWorkingSet).reduce((sum, s) => sum + setQualityFactor(s.rpe), 0);
}

/** Arrotonda a un decimale i valori "a serie" per la lettura */
export const roundSets = (value: number): number => Math.round(value * 10) / 10;
