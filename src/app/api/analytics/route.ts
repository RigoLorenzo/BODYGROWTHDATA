export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "overview";
  const userId = session.user.id;

  if (type === "overview") {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekEnd = subWeeks(weekEnd, 1);

    const [thisWeek, lastWeek, totalStats, streak] = await Promise.all([
      prisma.workoutSession.aggregate({
        where: { userId, status: "COMPLETED", startedAt: { gte: weekStart, lte: weekEnd } },
        _sum: { totalVolume: true },
        _count: true,
      }),
      prisma.workoutSession.aggregate({
        where: { userId, status: "COMPLETED", startedAt: { gte: prevWeekStart, lte: prevWeekEnd } },
        _sum: { totalVolume: true },
        _count: true,
      }),
      prisma.workoutSession.aggregate({
        where: { userId, status: "COMPLETED" },
        _sum: { totalVolume: true },
        _count: true,
      }),
      prisma.streak.findUnique({ where: { userId } }),
    ]);

    const volumeChange = lastWeek._sum.totalVolume
      ? (((thisWeek._sum.totalVolume ?? 0) - (lastWeek._sum.totalVolume ?? 0)) / (lastWeek._sum.totalVolume ?? 1)) * 100
      : 0;

    return NextResponse.json({
      thisWeek: {
        volume: thisWeek._sum.totalVolume ?? 0,
        workouts: thisWeek._count,
      },
      lastWeek: {
        volume: lastWeek._sum.totalVolume ?? 0,
        workouts: lastWeek._count,
      },
      total: {
        volume: totalStats._sum.totalVolume ?? 0,
        workouts: totalStats._count,
      },
      volumeChange: Math.round(volumeChange),
      streak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
    });
  }

  if (type === "heatmap") {
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: startDate, lte: endDate } },
      select: { startedAt: true, totalVolume: true, duration: true, rpe: true },
    });

    const heatmap = sessions.reduce((acc, s) => {
      const day = format(s.startedAt, "yyyy-MM-dd");
      if (!acc[day]) acc[day] = { volume: 0, count: 0, duration: 0 };
      acc[day].volume += s.totalVolume;
      acc[day].count += 1;
      acc[day].duration += s.duration ?? 0;
      return acc;
    }, {} as Record<string, { volume: number; count: number; duration: number }>);

    return NextResponse.json(heatmap);
  }

  if (type === "muscle-balance") {
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: subWeeks(new Date(), 8) } },
      include: {
        exercises: {
          include: {
            exercise: { select: { primaryMuscle: true } },
            sets: { where: { type: { not: "WARMUP" } }, select: { volume: true } },
          },
        },
      },
    });

    const muscleVolume: Record<string, number> = {};
    for (const session of sessions) {
      for (const ex of session.exercises) {
        const muscle = ex.exercise.primaryMuscle;
        if (!muscle) continue;
        const vol = ex.sets.reduce((sum, s) => sum + s.volume, 0);
        muscleVolume[muscle] = (muscleVolume[muscle] ?? 0) + vol;
      }
    }

    const result = Object.entries(muscleVolume)
      .map(([muscle, volume]) => ({ muscle, volume }))
      .sort((a, b) => b.volume - a.volume);

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
