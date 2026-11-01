import type { DeviceProvider } from "@prisma/client";
import { HISTORY_EMPTY_STOP_DAYS } from "./constants";
import {
  backwardUnits,
  forwardUnits,
  heartFloor,
  isoDay,
  oldestDay,
  toEpoch,
  utcMidnight,
  type Coverage,
  type Track,
  type Unit,
} from "./plan";
import { firstWellnessDay, hasWellnessDays } from "./store";

/**
 * Ordine di download del benessere, uguale per ogni orologio: prima i giorni
 * recenti (dati leggeri, poi battiti), poi lo storico a ritroso a turni. Ogni
 * blocco è indipendente e salvato appena scaricato; il cursore di ciascun
 * binario si salva dopo ogni blocco, così un'interruzione non perde nulla.
 * L'orologio fornisce solo come si scarica e salva un blocco.
 */

const DAY = 86_400;

/** Blocco interrotto per tempo: riprende alla sincronizzazione successiva */
export class UnitTimeout extends Error {}

export type CoverageField = "wellnessSyncedFrom" | "wellnessSyncedUntil" | "wellnessHrFrom" | "wellnessHrUntil";

interface LaneFields {
  from: CoverageField;
  until: CoverageField;
}
const LIGHT_FIELDS: LaneFields = { from: "wellnessSyncedFrom", until: "wellnessSyncedUntil" };
const HEART_FIELDS: LaneFields = { from: "wellnessHrFrom", until: "wellnessHrUntil" };

export interface WellnessLane {
  track: Track;
  /** Scarica e salva un blocco; restituisce i giorni salvati */
  run: (unit: Unit) => Promise<number>;
}

export interface WellnessDriver {
  userId: string;
  source: DeviceProvider;
  /** Sonno, FC a riposo, passi, stress, SpO₂… a blocchi di più giorni */
  light: WellnessLane;
  /** Battiti al minuto, un giorno alla volta */
  heart: WellnessLane;
  /** Salva i cursori sul collegamento dell'orologio */
  saveCoverage: (data: Partial<Record<CoverageField, Date>>) => Promise<unknown>;
}

/** Cursori salvati sul collegamento (stessi nomi per ogni orologio) */
export type StoredCoverage = Partial<Record<CoverageField, Date | null>>;

const coverageOf = (stored: StoredCoverage, fields: LaneFields): Coverage => ({
  from: toEpoch(stored[fields.from] ?? null),
  until: toEpoch(stored[fields.until] ?? null),
});

const today = () => utcMidnight(Date.now() / 1000);

async function runForward(driver: WellnessDriver, lane: WellnessLane, cov: Coverage, fields: LaneFields, deadline: number) {
  const now = today();
  let saved = 0;
  for (const unit of forwardUnits(cov, lane.track, now)) {
    if (Date.now() > deadline) break;
    saved += await lane.run(unit);
    // Oggi è parziale: il cursore resta all'inizio di oggi
    cov.until = Math.min(unit.from + unit.days * DAY, now);
    cov.from ??= unit.from;
    await driver.saveCoverage({ [fields.until]: new Date(cov.until * 1000), [fields.from]: new Date(cov.from * 1000) });
  }
  return saved;
}

/** Nessun giorno salvato nei 60 giorni da `from` in poi: prima l'orologio non c'era */
const historyEnded = async (driver: WellnessDriver, from: number) =>
  !(await hasWellnessDays(driver.userId, driver.source, isoDay(from), isoDay(from + HISTORY_EMPTY_STOP_DAYS * DAY)));

async function runBackward(
  driver: WellnessDriver,
  lane: WellnessLane,
  cov: Coverage,
  fields: LaneFields,
  deadline: number,
  opts: { floor?: number | null; stopWhenEmpty?: boolean; maxUnits?: number } = {}
) {
  const now = today();
  let saved = 0;
  let ran = 0;
  for (const unit of backwardUnits(cov, lane.track, now, opts.floor)) {
    if (Date.now() > deadline || ran >= (opts.maxUnits ?? Infinity)) break;
    ran++;
    const unitSaved = await lane.run(unit);
    saved += unitSaved;
    cov.from = unit.from;
    // Storico finito prima del limite: il binario è completo
    const ended = opts.stopWhenEmpty && !unitSaved && (await historyEnded(driver, unit.from));
    if (ended) cov.from = oldestDay(lane.track, now, opts.floor);
    await driver.saveCoverage({ [fields.from]: new Date(cov.from * 1000) });
    if (ended) break;
  }
  return { saved, ran };
}

/**
 * Recenti prima (leggeri, poi battiti), poi lo storico finché c'è tempo.
 * Restituisce i giorni salvati. `recent: false` (passi dedicati allo
 * storico) salta i giorni recenti, già aggiornati dalla sincronizzazione
 * normale: altrimenti ogni passo li rifarebbe e con un cloud lento lo
 * storico non avanzerebbe mai.
 */
export async function runWellnessPlan(
  driver: WellnessDriver,
  stored: StoredCoverage,
  deadline: number,
  opts: { recent?: boolean } = {}
) {
  const light = coverageOf(stored, LIGHT_FIELDS);
  const heart = coverageOf(stored, HEART_FIELDS);
  let saved = 0;
  try {
    const recent = opts.recent ?? true;
    // Senza punto di partenza lo storico non sa da dove andare a ritroso
    if (recent || light.from == null) saved += await runForward(driver, driver.light, light, LIGHT_FIELDS, deadline);
    if (recent || heart.from == null) saved += await runForward(driver, driver.heart, heart, HEART_FIELDS, deadline);
    // Storico a turni: un blocco leggero e 3 giorni di battiti per giro, così
    // i battiti non aspettano anni di dati leggeri prima di partire
    while (Date.now() < deadline) {
      const lightTurn = await runBackward(driver, driver.light, light, LIGHT_FIELDS, deadline, {
        stopWhenEmpty: true,
        maxUnits: 1,
      });
      // Con lo storico leggero completo i battiti si fermano al primo giorno con dati
      const lightDone = light.from != null && light.from <= oldestDay(driver.light.track, today());
      const floor = lightDone ? heartFloor(await firstWellnessDay(driver.userId, driver.source)) : null;
      const heartTurn = await runBackward(driver, driver.heart, heart, HEART_FIELDS, deadline, { floor, maxUnits: 3 });
      saved += lightTurn.saved + heartTurn.saved;
      if (!lightTurn.ran && !heartTurn.ran) break;
    }
  } catch (error) {
    if (!(error instanceof UnitTimeout)) throw error;
    console.warn(`benessere ${driver.source}: blocco interrotto per tempo, riprende alla prossima sincronizzazione`);
  }
  return saved;
}

/** Giorni locali di un blocco, per scartare quelli scaricati col margine */
export const unitDays = (unit: Unit) => {
  const first = isoDay(unit.from);
  const last = isoDay(unit.from + (unit.days - 1) * DAY);
  return { first, last, has: (date: string) => date >= first && date <= last };
};
