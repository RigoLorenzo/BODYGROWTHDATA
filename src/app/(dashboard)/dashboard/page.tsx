import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withProgramDayNames } from "@/lib/program-day-names";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TodayHero } from "@/components/dashboard/today-hero";
import { WeekCard } from "@/components/dashboard/week-card";
import { RecentWorkouts } from "@/components/dashboard/recent-workouts";
import { InsightCard } from "@/components/analytics/insight-card";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { weekOverview } from "@/lib/overview";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  let statsData = null;
  let recentWorkouts = null;
  const heatmapData: Record<string, { volume: number; runs: number }> = {};

  if (userId) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    try {
      const [overview, sessions, recentSessions] = await Promise.all([
        weekOverview(userId, now),
        prisma.workoutSession.findMany({
          where: { userId, status: "COMPLETED", startedAt: { gte: weekStart, lte: weekEnd } },
          select: { startedAt: true, totalVolume: true, workoutType: true },
        }),
        prisma.workoutSession.findMany({
          where: { userId, status: { not: "ABANDONED" } },
          orderBy: { startedAt: "desc" },
          take: 5,
          include: {
            exercises: {
              include: { exercise: { select: { name: true, primaryMuscle: true } } },
            },
            run: { select: { id: true, name: true, distance: true, movingTime: true } },
            _count: { select: { personalRecords: true } },
          },
        }),
      ]);

      statsData = overview;
      recentWorkouts = await withProgramDayNames(recentSessions);

      for (const s of sessions) {
        const day = format(s.startedAt, "yyyy-MM-dd");
        const current = heatmapData[day] ?? { volume: 0, runs: 0 };
        heatmapData[day] = {
          volume: current.volume + s.totalVolume,
          runs: current.runs + (s.workoutType === "CARDIO" ? 1 : 0),
        };
      }
    } catch {
      // DB unavailable — dashboard renders with empty state, API routes will retry client-side
    }
  }

  return (
    <div className="container max-w-xl mx-auto px-4 pt-3 pb-6 space-y-5">
      <DashboardHeader user={session?.user ?? {}} />

      <TodayHero />

      <WeekCard
        initialOverview={statsData ?? undefined}
        initialDays={Object.keys(heatmapData).length ? heatmapData : undefined}
      />

      <Suspense fallback={<Skeleton className="h-24 rounded-3xl" />}>
        <InsightCard />
      </Suspense>

      <RecentWorkouts initialData={recentWorkouts ?? undefined} />
    </div>
  );
}
