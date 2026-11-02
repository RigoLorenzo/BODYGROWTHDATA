/** Lettura sicura dei parametri delle API: numeri limitati e istanti ISO validati */

export function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const value = parseInt(raw ?? "", 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Istante ISO 8601 ("2026-09-30T22:00:00.000Z"); null se assente o non valido */
export function parseInstant(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(raw)) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
