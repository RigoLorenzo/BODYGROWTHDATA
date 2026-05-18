export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, subWeeks, subDays, differenceInDays, format } from "date-fns";

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
            sets: { where: { type: { not: "WARMUP" } }, select: { volume: true, reps: true } },
          },
        },
      },
    });

    const muscleData: Record<string, { tonnage: number; volume: number }> = {};
    for (const session of sessions) {
      for (const ex of session.exercises) {
        const muscle = ex.exercise.primaryMuscle;
        if (!muscle) continue;
        if (!muscleData[muscle]) muscleData[muscle] = { tonnage: 0, volume: 0 };
        for (const s of ex.sets) {
          muscleData[muscle].tonnage += s.volume; // volume field = weight × reps
          muscleData[muscle].volume += s.reps ?? 0; // pure reps = volume without weight
        }
      }
    }

    const result = Object.entries(muscleData)
      .map(([muscle, d]) => ({ muscle, tonnage: d.tonnage, volume: d.volume }))
      .sort((a, b) => b.tonnage - a.tonnage);

    return NextResponse.json(result);
  }

  if (type === "muscle-stats") {
    const weeks = parseInt(searchParams.get("weeks") ?? "8");
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: subWeeks(new Date(), weeks) } },
      include: {
        exercises: {
          include: {
            exercise: { select: { primaryMuscle: true } },
            sets: { where: { type: { not: "WARMUP" } }, select: { volume: true, reps: true, weight: true } },
          },
        },
      },
    });

    const stats: Record<string, { totalSets: number; totalReps: number; tonnage: number; volume: number }> = {};
    for (const session of sessions) {
      for (const ex of session.exercises) {
        const muscle = ex.exercise.primaryMuscle;
        if (!muscle) continue;
        if (!stats[muscle]) stats[muscle] = { totalSets: 0, totalReps: 0, tonnage: 0, volume: 0 };
        stats[muscle].totalSets += ex.sets.length;
        for (const s of ex.sets) {
          stats[muscle].totalReps += s.reps ?? 0;
          stats[muscle].tonnage += s.volume;
          stats[muscle].volume += s.reps ?? 0;
        }
      }
    }

    return NextResponse.json(stats);
  }

  if (type === "muscle-frequency") {
    const days = parseInt(searchParams.get("days") ?? "14");
    const since = subDays(new Date(), days);

    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
        exercises: {
          select: { exercise: { select: { primaryMuscle: true } } },
        },
      },
    });

    const ALL_MUSCLES = [
      "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS",
      "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
    ];

    const muscleData: Record<string, { count: number; lastWorked: string | null; daysSince: number | null }> = {};
    for (const m of ALL_MUSCLES) {
      muscleData[m] = { count: 0, lastWorked: null, daysSince: null };
    }

    for (const s of sessions) {
      const worked = Array.from(new Set(s.exercises.map((ex) => ex.exercise.primaryMuscle).filter(Boolean)));
      for (const muscle of worked) {
        if (!muscle || !muscleData[muscle]) continue;
        muscleData[muscle].count++;
        if (muscleData[muscle].lastWorked === null) {
          muscleData[muscle].lastWorked = format(s.startedAt, "yyyy-MM-dd");
          muscleData[muscle].daysSince = differenceInDays(new Date(), s.startedAt);
        }
      }
    }

    return NextResponse.json(muscleData);
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
