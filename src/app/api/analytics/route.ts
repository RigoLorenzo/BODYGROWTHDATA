export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek, subWeeks, subDays, differenceInDays, format } from "date-fns";
import { computeProgressScore } from "@/lib/progress-score";
import {
  accumulateMuscleSets,
  countWorkingSets,
  roundSets,
  type MuscleSetTotals,
} from "@/lib/muscle-volume";

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

  if (type === "progress") {
    const progress = await computeProgressScore(userId);
    return NextResponse.json(progress, {
      headers: { "Cache-Control": "private, max-age=300" },
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
    // Il bilanciamento si legge sulle serie efficaci per muscolo; il
    // tonnellaggio resta come statistica separata.
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: subWeeks(new Date(), 8) } },
      include: {
        exercises: {
          include: {
            exercise: { select: { primaryMuscle: true, muscleGroups: true, muscleContributions: true } },
            sets: {
              where: { type: { not: "WARMUP" } },
              select: { weight: true, reps: true, rpe: true, type: true },
            },
          },
        },
      },
    });

    const muscleData: Record<string, MuscleSetTotals> = {};
    for (const session of sessions) {
      for (const ex of session.exercises) {
        accumulateMuscleSets(muscleData, ex.exercise, ex.sets);
      }
    }

    const result = Object.entries(muscleData)
      .map(([muscle, d]) => ({
        muscle,
        directSets: d.directSets,
        indirectSets: d.indirectSets,
        effectiveSets: roundSets(d.effectiveSets),
        tonnage: Math.round(d.tonnage),
        volume: Math.round(d.reps),
      }))
      .sort((a, b) => b.effectiveSets - a.effectiveSets);

    return NextResponse.json(result);
  }

  if (type === "muscle-stats") {
    const weeks = parseInt(searchParams.get("weeks") ?? "8");
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: subWeeks(new Date(), weeks) } },
      include: {
        exercises: {
          include: {
            exercise: { select: { primaryMuscle: true, muscleGroups: true, muscleContributions: true } },
            sets: {
              where: { type: { not: "WARMUP" } },
              select: { volume: true, reps: true, weight: true, rpe: true, type: true },
            },
          },
        },
      },
    });

    // Serie attribuite ai muscoli (dirette, indirette, efficaci)
    const muscleData: Record<string, MuscleSetTotals> = {};
    // Statistiche del solo muscolo primario, come prima
    const stats: Record<
      string,
      {
        totalSets: number;
        totalReps: number;
        tonnage: number;
        volume: number;
        directSets: number;
        indirectSets: number;
        effectiveSets: number;
      }
    > = {};

    for (const session of sessions) {
      for (const ex of session.exercises) {
        accumulateMuscleSets(muscleData, ex.exercise, ex.sets);

        const muscle = ex.exercise.primaryMuscle;
        if (!muscle) continue;
        if (!stats[muscle]) {
          stats[muscle] = {
            totalSets: 0,
            totalReps: 0,
            tonnage: 0,
            volume: 0,
            directSets: 0,
            indirectSets: 0,
            effectiveSets: 0,
          };
        }
        stats[muscle].totalSets += ex.sets.length;
        for (const s of ex.sets) {
          stats[muscle].totalReps += s.reps ?? 0;
          stats[muscle].tonnage += s.volume;
          stats[muscle].volume += s.reps ?? 0;
        }
      }
    }

    for (const [muscle, totals] of Object.entries(muscleData)) {
      if (!stats[muscle]) {
        stats[muscle] = {
          totalSets: 0,
          totalReps: 0,
          tonnage: 0,
          volume: 0,
          directSets: 0,
          indirectSets: 0,
          effectiveSets: 0,
        };
      }
      stats[muscle].directSets = totals.directSets;
      stats[muscle].indirectSets = totals.indirectSets;
      stats[muscle].effectiveSets = roundSets(totals.effectiveSets);
    }

    return NextResponse.json(stats);
  }

  if (type === "weekly") {
    // Ultime 8 settimane: tonnellaggio (Volume Load), serie di lavoro,
    // frequenza e serie efficaci per muscolo.
    const weeks = Math.min(parseInt(searchParams.get("weeks") ?? "8"), 26);
    const firstWeekStart = startOfWeek(subWeeks(new Date(), weeks - 1), { weekStartsOn: 1 });

    const sessions = await prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: firstWeekStart } },
      select: {
        startedAt: true,
        totalVolume: true,
        exercises: {
          select: {
            exercise: { select: { primaryMuscle: true, muscleGroups: true, muscleContributions: true } },
            sets: {
              where: { type: { not: "WARMUP" } },
              select: { weight: true, reps: true, rpe: true, type: true },
            },
          },
        },
      },
    });

    const buckets = Array.from({ length: weeks }, (_, i) => {
      const start = startOfWeek(subWeeks(new Date(), weeks - 1 - i), { weekStartsOn: 1 });
      return {
        weekStart: format(start, "yyyy-MM-dd"),
        label: format(start, "d MMM"),
        start,
        end: endOfWeek(start, { weekStartsOn: 1 }),
        tonnage: 0,
        workingSets: 0,
        sessions: 0,
        muscles: {} as Record<string, MuscleSetTotals>,
      };
    });

    for (const session of sessions) {
      const bucket = buckets.find((b) => session.startedAt >= b.start && session.startedAt <= b.end);
      if (!bucket) continue;
      bucket.sessions += 1;
      bucket.tonnage += session.totalVolume ?? 0;
      for (const ex of session.exercises) {
        bucket.workingSets += countWorkingSets(ex.sets);
        accumulateMuscleSets(bucket.muscles, ex.exercise, ex.sets);
      }
    }

    const weeksPayload = buckets.map((b) => ({
      weekStart: b.weekStart,
      label: b.label,
      tonnage: Math.round(b.tonnage),
      workingSets: b.workingSets,
      sessions: b.sessions,
      effectiveSetsByMuscle: Object.fromEntries(
        Object.entries(b.muscles).map(([muscle, totals]) => [muscle, roundSets(totals.effectiveSets)])
      ),
      directSetsByMuscle: Object.fromEntries(
        Object.entries(b.muscles).map(([muscle, totals]) => [muscle, totals.directSets])
      ),
    }));

    const activeWeeks = weeksPayload.filter((w) => w.sessions > 0).length;
    const totalSessions = weeksPayload.reduce((sum, w) => sum + w.sessions, 0);

    return NextResponse.json({
      weeks: weeksPayload,
      // Frequenza di allenamento: media a settimana sulle settimane in cui ti sei allenato
      trainingFrequency: activeWeeks > 0 ? Math.round((totalSessions / activeWeeks) * 10) / 10 : 0,
      weeklyAverageWorkingSets:
        activeWeeks > 0
          ? Math.round(weeksPayload.reduce((sum, w) => sum + w.workingSets, 0) / activeWeeks)
          : 0,
    });
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
