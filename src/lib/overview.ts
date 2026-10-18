import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
import { prisma } from "./prisma";

/**
 * Riepilogo settimanale per home e Analytics. Le corse sono sedute di tipo
 * CARDIO: contano per streak e allenamenti, ma "sedute" del piano e volume
 * restano quelle in palestra.
 */
export async function weekOverview(userId: string, now: Date = new Date()) {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const prevStart = subWeeks(weekStart, 1);
  const prevEnd = subWeeks(weekEnd, 1);
  const completed = { userId, status: "COMPLETED" as const };
  const gym = { workoutType: { not: "CARDIO" as const } };

  const [thisWeek, thisWeekGym, lastWeek, total, runsThisWeek, streak] = await Promise.all([
    prisma.workoutSession.aggregate({ where: { ...completed, startedAt: { gte: weekStart, lte: weekEnd } }, _sum: { totalVolume: true }, _count: true }),
    prisma.workoutSession.count({ where: { ...completed, ...gym, startedAt: { gte: weekStart, lte: weekEnd } } }),
    prisma.workoutSession.aggregate({ where: { ...completed, startedAt: { gte: prevStart, lte: prevEnd } }, _sum: { totalVolume: true }, _count: true }),
    prisma.workoutSession.aggregate({ where: completed, _sum: { totalVolume: true }, _count: true }),
    prisma.runActivity.aggregate({ where: { userId, startedAt: { gte: weekStart, lte: weekEnd } }, _sum: { distance: true }, _count: true }),
    prisma.streak.findUnique({ where: { userId } }),
  ]);

  const thisVolume = thisWeek._sum.totalVolume ?? 0;
  const lastVolume = lastWeek._sum.totalVolume ?? 0;
  return {
    thisWeek: {
      volume: thisVolume,
      workouts: thisWeek._count,
      gymWorkouts: thisWeekGym,
      runs: runsThisWeek._count,
      runDistance: runsThisWeek._sum.distance ?? 0,
    },
    lastWeek: { volume: lastVolume, workouts: lastWeek._count },
    total: { volume: total._sum.totalVolume ?? 0, workouts: total._count },
    volumeChange: lastVolume ? Math.round(((thisVolume - lastVolume) / lastVolume) * 100) : 0,
    streak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
  };
}
