import { prisma } from "./prisma";

/**
 * Aggiunge il nome del giorno del piano agli allenamenti che ne hanno uno,
 * così le liste mostrano "G2 — Gambe A" invece di un tipo generico.
 */
export async function withProgramDayNames<T extends { programDayId: string | null }>(
  workouts: T[]
): Promise<(T & { programDayName: string | null })[]> {
  const ids = Array.from(new Set(workouts.map((w) => w.programDayId).filter((id): id is string => !!id)));
  const days = ids.length
    ? await prisma.programDay.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const names = new Map(days.map((d) => [d.id, d.name]));
  return workouts.map((w) => ({ ...w, programDayName: w.programDayId ? names.get(w.programDayId) ?? null : null }));
}
