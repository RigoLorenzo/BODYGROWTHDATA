import { HEART_HISTORY_DAYS, WELLNESS_HISTORY_DAYS } from "@/lib/wellness/constants";
import type { HistoryTrack, WellnessProgress } from "@/lib/wellness/types";

/**
 * Quali giorni scaricare e in che ordine (funzioni pure, senza rete né DB):
 * prima i recenti, poi lo storico a ritroso, a blocchi di giorni locali.
 */

const DAY = 86_400;

export interface Track {
  /** giorni per blocco */
  unitDays: number;
  historyDays: number;
  /** giorni recenti riletti ogni volta (i dati arrivano in ritardo), oltre a oggi */
  refreshDays: number;
}
export const LIGHT_TRACK: Track = { unitDays: 10, historyDays: WELLNESS_HISTORY_DAYS, refreshDays: 2 };
export const HEART_TRACK: Track = { unitDays: 1, historyDays: HEART_HISTORY_DAYS, refreshDays: 1 };

/** Giorni locali già scaricati: [from, until), come mezzanotti UTC delle date */
export interface Coverage {
  from: number | null;
  until: number | null;
}
export interface Unit {
  from: number;
  days: number;
}

export const utcMidnight = (epoch: number) => Math.floor(epoch / DAY) * DAY;
export const isoDay = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 10);
export const toEpoch = (d: Date | null) => (d ? utcMidnight(d.getTime() / 1000) : null);

/** Blocchi recenti, in ordine: dall'ultimo giorno completo (meno il margine) a oggi */
export function forwardUnits(cov: Coverage, track: Track, today: number): Unit[] {
  const start = Math.min(cov.until ?? today, today) - track.refreshDays * DAY;
  const units: Unit[] = [];
  for (let from = start; from <= today; from += track.unitDays * DAY) {
    units.push({ from, days: Math.min(track.unitDays, (today - from) / DAY + 1) });
  }
  return units;
}

/** Primo giorno da scaricare: limite del binario o, se noto, inizio dei dati */
export function oldestDay(track: Track, today: number, floor: number | null = null) {
  return Math.max(today - (track.historyDays - 1) * DAY, floor ?? -Infinity);
}

/** Blocchi dello storico, dal più recente al più vecchio */
export function backwardUnits(cov: Coverage, track: Track, today: number, floor: number | null = null): Unit[] {
  const oldest = oldestDay(track, today, floor);
  const units: Unit[] = [];
  for (let to = cov.from ?? today; to > oldest; to -= track.unitDays * DAY) {
    const days = Math.min(track.unitDays, (to - oldest) / DAY);
    units.push({ from: to - days * DAY, days });
  }
  return units;
}

/** Giorni coperti sul totale previsto, per la barra di avanzamento */
export function coverageDays(cov: Coverage, track: Track, today: number, floor: number | null = null): HistoryTrack {
  const total = (today - oldestDay(track, today, floor)) / DAY + 1;
  const done = cov.from == null ? 0 : Math.min(total, (today - cov.from) / DAY + 1);
  return { done, total, since: cov.from == null ? null : isoDay(cov.from), complete: done >= total };
}

/**
 * Avanzamento dello storico per la pagina Benessere. I battiti si fermano al
 * primo giorno con dati, noto quando lo storico leggero è completo.
 */
export function wellnessProgress(
  conn: { wellnessSyncedFrom: Date | null; wellnessHrFrom: Date | null },
  firstDataDay: string | null
): WellnessProgress {
  const today = utcMidnight(Date.now() / 1000);
  const light = coverageDays({ from: toEpoch(conn.wellnessSyncedFrom), until: null }, LIGHT_TRACK, today);
  const floor = light.complete ? heartFloor(firstDataDay) : null;
  const heart = coverageDays({ from: toEpoch(conn.wellnessHrFrom), until: null }, HEART_TRACK, today, floor);
  // Finito lo storico, "dal" è il primo giorno con dati, non il limite dei 3 anni
  if (light.complete && firstDataDay) light.since = firstDataDay;
  return { light, heart, complete: light.complete && heart.complete };
}

export const heartFloor = (firstDataDay: string | null) =>
  firstDataDay ? Date.parse(`${firstDataDay}T00:00:00Z`) / 1000 : null;
