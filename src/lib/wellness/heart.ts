import type { HourlyHr } from "./types";

/** Battiti al minuto di qualsiasi orologio: funzioni pure sugli aggregati */

export interface HeartSample {
  /** secondi epoch */
  time: number;
  value: number;
}

const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
const min = (values: number[]) => values.reduce((m, v) => (v < m ? v : m), Infinity);

/** FC media e minima tra due istanti (secondi), se ci sono abbastanza campioni */
export function heartRateBetween(samples: HeartSample[], from: number, to: number): { avgHr: number; minHr: number } | null {
  const values = samples.filter((s) => s.time >= from && s.time <= to).map((s) => s.value);
  if (values.length < 10) return null;
  return { avgHr: Math.round(avg(values)), minHr: min(values) };
}

/** Sotto questa copertura della notte i battiti sono parziali (es. solo dopo mezzanotte) */
const FULL_NIGHT_COVERAGE = 0.8;

export interface NightHeartRate {
  avgHr: number;
  minHr: number;
  maxHr: number;
  /** la notte è coperta quasi tutta dai campioni */
  complete: boolean;
}

/**
 * FC media, minima e massima tra due istanti (secondi) e quanto della notte
 * coprono i campioni (passo tipico tra campioni × numero, sulla durata).
 */
export function nightHeartRate(samples: HeartSample[], from: number, to: number): NightHeartRate | null {
  const inside = samples.filter((s) => s.time >= from && s.time <= to).sort((a, b) => a.time - b.time);
  if (inside.length < 10 || to <= from) return null;
  const steps = inside.slice(1).map((s, i) => s.time - inside[i].time).sort((a, b) => a - b);
  const step = steps[steps.length >> 1] || 60;
  const values = inside.map((s) => s.value);
  return {
    avgHr: Math.round(avg(values)),
    minHr: min(values),
    maxHr: Math.max(...values),
    complete: Math.min(1, (inside.length * step) / (to - from)) >= FULL_NIGHT_COVERAGE,
  };
}

/** Ora locale (0-23) di un istante in secondi */
export type HourOf = (time: number) => number;

/** Ora locale con uno scostamento fisso da UTC (secondi) */
export const offsetHour =
  (offset: number): HourOf =>
  (time) =>
    new Date((time + offset) * 1000).getUTCHours();

/** Ora locale in un fuso IANA (es. Europe/Rome), cambio d'ora compreso */
export function zoneHour(timeZone: string): HourOf | null {
  try {
    const format = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
    return (time) => Number(format.format(new Date(time * 1000))) % 24;
  } catch {
    return null;
  }
}

/** Curva oraria dei battiti */
export function hourlyHeartRate(samples: HeartSample[], hourOf: HourOf): HourlyHr[] {
  const hours = new Map<number, number[]>();
  for (const s of samples) {
    const h = hourOf(s.time);
    const list = hours.get(h);
    if (list) list.push(s.value);
    else hours.set(h, [s.value]);
  }
  return [...hours.entries()]
    .sort(([a], [b]) => a - b)
    .map(([h, v]) => ({ h, avg: Math.round(avg(v)), min: min(v), max: Math.max(...v) }));
}
