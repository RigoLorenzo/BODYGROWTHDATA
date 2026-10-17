/**
 * Avanzamento del piano: `currentDay` conta i giorni fatti dall'inizio.
 * Completando il giorno `index` del ciclo corrente, il prossimo consigliato
 * diventa quello successivo (dopo l'ultimo si riparte dal primo).
 */
export function nextCurrentDay(currentDay: number, dayCount: number, index: number): number {
  if (dayCount < 1 || index < 0 || index >= dayCount) return currentDay;
  const cycleStart = Math.floor(currentDay / dayCount) * dayCount;
  return cycleStart + index + 1;
}

/** Giorno consigliato (indice nel ciclo) a partire dal contatore */
export const suggestedDayIndex = (currentDay: number, dayCount: number): number =>
  dayCount > 0 ? currentDay % dayCount : 0;
