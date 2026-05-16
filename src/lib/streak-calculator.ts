import { differenceInDays, startOfDay } from "date-fns";

export function calculateStreak(
  workoutDates: Date[],
  graceDays: number = 1
): { current: number; longest: number } {
  if (!workoutDates.length) return { current: 0, longest: 0 };

  const uniqueDays = Array.from(new Set(workoutDates.map((d) => startOfDay(d).getTime())))
    .sort((a, b) => b - a)
    .map((t) => new Date(t));

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = startOfDay(new Date());
  const mostRecent = uniqueDays[0];
  const daysSinceLast = differenceInDays(today, mostRecent);

  if (daysSinceLast > 1 + graceDays) {
    currentStreak = 0;
  } else {
    currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const gap = differenceInDays(uniqueDays[i - 1], uniqueDays[i]);
      if (gap <= 1 + graceDays) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  for (let i = 1; i < uniqueDays.length; i++) {
    const gap = differenceInDays(uniqueDays[i - 1], uniqueDays[i]);
    if (gap <= 1 + graceDays) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak, 1);

  return { current: currentStreak, longest: longestStreak };
}

export async function updateUserStreak(userId: string): Promise<void> {
  const { prisma } = await import("./prisma");

  const sessions = await prisma.workoutSession.findMany({
    where: { userId, status: "COMPLETED" },
    select: { startedAt: true },
    orderBy: { startedAt: "desc" },
  });

  const dates = sessions.map((s) => s.startedAt);
  const { current, longest } = calculateStreak(dates);

  await prisma.streak.upsert({
    where: { userId },
    update: {
      currentStreak: current,
      longestStreak: longest,
      lastWorkoutDate: dates[0] ?? null,
      totalWorkouts: sessions.length,
    },
    create: {
      userId,
      currentStreak: current,
      longestStreak: longest,
      lastWorkoutDate: dates[0] ?? null,
      totalWorkouts: sessions.length,
    },
  });
}
