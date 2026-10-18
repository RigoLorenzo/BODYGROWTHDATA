/** Formattazione dei dati di corsa (ritmo, velocità, tempi, distanze) */

/** Secondi al km; null se la distanza è nulla */
export const paceSecondsPerKm = (meters: number, seconds: number): number | null =>
  meters > 0 && seconds > 0 ? seconds / (meters / 1000) : null;

/** 312 → "5'12\"" */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "–";
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}'${String(total % 60).padStart(2, "0")}"`;
}

/** km/h con un decimale e virgola */
export const formatSpeed = (meters: number, seconds: number): string =>
  seconds > 0 ? ((meters / seconds) * 3.6).toFixed(1).replace(".", ",") : "–";

/** 3725 → "1:02:05", 1505 → "25:05" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/** 10234 → "10,23" (km, due decimali; uno sopra i 100 km) */
export const formatKm = (meters: number): string =>
  (meters / 1000).toFixed(meters >= 100_000 ? 1 : 2).replace(".", ",");

/** "1:02:05" | "25:05" | "25" (minuti) → secondi; null se non valido */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(":").map((p) => p.trim());
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}
