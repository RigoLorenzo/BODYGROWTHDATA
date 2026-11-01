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
