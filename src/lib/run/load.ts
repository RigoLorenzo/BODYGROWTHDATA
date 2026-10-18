/**
 * Carico di allenamento della corsa (come "Fitness e forma" di Strava).
 *
 * TRIMP di Banister: minuti × riserva cardiaca × 0,64·e^(1,92·riserva).
 * Senza frequenza cardiaca si stima un'intensità moderata (riserva 0,65).
 * Fitness (CTL) = media esponenziale a 42 giorni del carico giornaliero,
 * Fatica (ATL) = a 7 giorni, Forma (TSB) = Fitness − Fatica.
 */

export const DEFAULT_MAX_HR = 190;
export const DEFAULT_RESTING_HR = 60;
const FALLBACK_RESERVE = 0.65;

export function trimp(
  movingSeconds: number,
  avgHr: number | null | undefined,
  maxHr = DEFAULT_MAX_HR,
  restingHr = DEFAULT_RESTING_HR
): number {
  const minutes = movingSeconds / 60;
  const reserve =
    avgHr && maxHr > restingHr
      ? Math.min(1, Math.max(0, (avgHr - restingHr) / (maxHr - restingHr)))
      : FALLBACK_RESERVE;
  return Math.round(minutes * reserve * 0.64 * Math.exp(1.92 * reserve) * 10) / 10;
}

export interface FitnessPoint {
  date: string; // yyyy-MM-dd
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
}

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Serie giornaliera di fitness/fatica/forma fino a `until` (incluso).
 * I carichi precedenti a `days` giorni fa servono a "scaldare" le medie.
 */
export function fitnessSeries(
  loads: { date: Date; load: number }[],
  days: number,
  until: Date = new Date()
): FitnessPoint[] {
  const byDay = new Map<string, number>();
  for (const { date, load } of loads) {
    const key = isoDay(date.getTime());
    byDay.set(key, (byDay.get(key) ?? 0) + load);
  }
  const end = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  const first = loads.length
    ? Math.min(...loads.map((l) => Date.UTC(l.date.getUTCFullYear(), l.date.getUTCMonth(), l.date.getUTCDate())))
    : end;
  const start = Math.min(first, end - (days - 1) * DAY);

  const kFit = 1 - Math.exp(-1 / 42);
  const kFat = 1 - Math.exp(-1 / 7);
  let fitness = 0;
  let fatigue = 0;
  const out: FitnessPoint[] = [];
  for (let t = start; t <= end; t += DAY) {
    const date = isoDay(t);
    const load = byDay.get(date) ?? 0;
    fitness += (load - fitness) * kFit;
    fatigue += (load - fatigue) * kFat;
    if (t > end - days * DAY) {
      out.push({
        date,
        load,
        fitness: Math.round(fitness * 10) / 10,
        fatigue: Math.round(fatigue * 10) / 10,
        form: Math.round((fitness - fatigue) * 10) / 10,
      });
    }
  }
  return out;
}

/** Lettura della forma, come indicazione pratica */
export function formLabel(form: number): { label: string; tone: "fresh" | "neutral" | "tired" | "overreach" } {
  if (form > 5) return { label: "Fresco: buon momento per spingere", tone: "fresh" };
  if (form >= -10) return { label: "Equilibrato", tone: "neutral" };
  if (form >= -30) return { label: "In carico: stai costruendo fitness", tone: "tired" };
  return { label: "Molto affaticato: valuta un giorno facile", tone: "overreach" };
}
