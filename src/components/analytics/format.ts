/** Formattazione compatta per le statistiche */

/** 4500 → "1h 15m", 2700 → "45 min", 360000 → "100 h" */
export function formatHours(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 100 || m === 0) return `${h} h`;
  return `${h}h ${m}m`;
}

/** Decimale all'italiana: 3.5 → "3,5" */
export const formatDecimal = (value: number, digits = 1): string =>
  value.toFixed(digits).replace(".", ",").replace(/,0+$/, "");

/** "80,4t" → ["80,4", "t"], "500 kg" → ["500", "kg"]: l'unità si scrive più piccola */
export function splitUnit(text: string): [string, string | undefined] {
  const match = text.match(/^([\d.,]+)\s*([a-zA-Z]+)$/);
  return match ? [match[1], match[2]] : [text, undefined];
}
