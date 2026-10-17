import { prisma } from "./prisma";
import { nextCurrentDay } from "./plan-cycle";

/**
 * Dopo aver completato un giorno del piano attivo, il prossimo consigliato è
 * quello successivo. Se il giorno non appartiene al piano attivo non cambia nulla.
 */
export async function advanceActiveProgram(userId: string, programDayId: string) {
  const active = await prisma.activeProgram.findUnique({
    where: { userId },
    include: { program: { include: { days: { select: { id: true }, orderBy: { dayIndex: "asc" } } } } },
  });
  if (!active) return;

  const days = active.program.days;
  const index = days.findIndex((d) => d.id === programDayId);
  if (index < 0) return;

  await prisma.activeProgram.update({
    where: { userId },
    data: { currentDay: nextCurrentDay(active.currentDay, days.length, index) },
  });
}
