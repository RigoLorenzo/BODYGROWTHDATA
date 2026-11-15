/**
 * Durata delle sedute in palestra: quando è anomala (allenamento dimenticato
 * aperto), come stimarla dallo storico e quando un allenamento in corso è fermo.
 * Modulo puro: lo usano server, script di correzione e client.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;

/** Oltre questa durata una seduta in palestra è quasi certamente un allenamento dimenticato aperto */
export const MAX_PLAUSIBLE_SECONDS = 4 * HOUR;
/** Sotto questa durata la seduta non fa testo per la stima (registrata a posteriori, prova) */
const MIN_SAMPLE_SECONDS = 10 * MINUTE;
/** Senza storico: un'ora */
export const DEFAULT_DURATION_SECONDS = HOUR;
/** Dopo l'ultima serie si conta ancora un recupero, poi l'allenamento è finito */
export const AFTER_LAST_SET_SECONDS = 3 * MINUTE;
/** Fermo da più di così: probabilmente l'hai dimenticato aperto */
export const IDLE_SECONDS = 90 * MINUTE;
/** Le stime dello stesso giorno del piano valgono solo con almeno tante sedute */
const MIN_SAME_DAY_SAMPLES = 2;

export interface DurationSample {
  programDayId: string | null;
  duration: number | null;
}

export const isAbnormalDuration = (seconds: number | null | undefined) => (seconds ?? 0) > MAX_PLAUSIBLE_SECONDS;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Durata più probabile di una seduta: la mediana delle sedute normali dello
 * stesso giorno del piano, altrimenti di tutte le sedute, altrimenti un'ora.
 * La mediana non si fa spostare da altre sedute anomale.
 */
export function estimateDuration(target: { programDayId: string | null }, history: DurationSample[]): number {
  const normal = history.filter(
    (s): s is { programDayId: string | null; duration: number } =>
      s.duration != null && s.duration >= MIN_SAMPLE_SECONDS && s.duration <= MAX_PLAUSIBLE_SECONDS
  );
  const sameDay = target.programDayId ? normal.filter((s) => s.programDayId === target.programDayId) : [];
  const pool = sameDay.length >= MIN_SAME_DAY_SAMPLES ? sameDay : normal;
  return median(pool.map((s) => s.duration)) ?? DEFAULT_DURATION_SECONDS;
}

/** Ora dell'ultima serie spuntata (null se nessuna ha l'orario) */
export function lastSetAt(exercises: { sets: { completed: boolean; completedAt?: string }[] }[]): Date | null {
  let last: number | null = null;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!s.completed || !s.completedAt) continue;
      const t = Date.parse(s.completedAt);
      if (Number.isFinite(t) && (last == null || t > last)) last = t;
    }
  }
  return last == null ? null : new Date(last);
}

export interface StaleSession {
  /** ultima attività: ultima serie spuntata o, se nessuna, l'inizio */
  lastActivity: Date;
  /** poco dopo l'ultima serie; null se le serie non hanno l'orario (app precedente) o non ce ne sono */
  suggestedEnd: Date | null;
  /** nessuna serie fatta: si propone di scartarlo */
  hasDoneSets: boolean;
  idleSeconds: number;
}

/**
 * Allenamento in corso fermo da più di 90 minuti: probabilmente dimenticato
 * aperto. Propone di chiuderlo poco dopo l'ultima serie, non adesso.
 */
export function staleSession(
  session: { startedAt: Date | string; exercises: { sets: { completed: boolean; completedAt?: string }[] }[] },
  now: Date
): StaleSession | null {
  const started = new Date(session.startedAt);
  const hasDoneSets = session.exercises.some((ex) => ex.sets.some((s) => s.completed));
  const last = lastSetAt(session.exercises);
  // Serie fatte con versioni precedenti dell'app non hanno l'orario: si parte dall'inizio
  const lastActivity = last ?? started;
  const idleSeconds = Math.floor((now.getTime() - lastActivity.getTime()) / 1000);
  if (idleSeconds < IDLE_SECONDS) return null;
  const end = hasDoneSets && last ? new Date(Math.min(last.getTime() + AFTER_LAST_SET_SECONDS * 1000, now.getTime())) : null;
  return { lastActivity, suggestedEnd: end, hasDoneSets, idleSeconds };
}

/**
 * Fine allenamento da salvare: quella scelta dall'utente se plausibile
 * (tra l'inizio e adesso), altrimenti adesso.
 */
export function resolveEndedAt(startedAt: Date, now: Date, requested?: string | null): Date {
  if (!requested) return now;
  const t = Date.parse(requested);
  if (!Number.isFinite(t) || t <= startedAt.getTime()) return now;
  return new Date(Math.min(t, now.getTime()));
}
