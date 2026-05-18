import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecentWorkouts } from "@/components/dashboard/recent-workouts";
import { WeeklyHeatmap } from "@/components/calendar/weekly-heatmap";
import { QuickStart } from "@/components/session/quick-start";
import { InsightCard } from "@/components/analytics/insight-card";
import { TodayPlanCard } from "@/components/programs/today-plan-card";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfWeek, endOfWeek, subWeeks, format, subDays } from "date-fns";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  let statsData = null;
  let recentWorkouts = null;
  const heatmapData: Record<string, { volume: number }> = {};

  if (userId) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekEnd = subWeeks(weekEnd, 1);
    const sevenDaysAgo = subDays(now, 6);

    try {
      const [thisWeek, lastWeek, total, streak, sessions, recentSessions] =
        await Promise.all([
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
          prisma.workoutSession.findMany({
            where: { userId, status: "COMPLETED", startedAt: { gte: sevenDaysAgo } },
            select: { startedAt: true, totalVolume: true },
          }),
          prisma.workoutSession.findMany({
            where: { userId, status: { not: "ABANDONED" } },
            orderBy: { startedAt: "desc" },
            take: 5,
            include: {
              exercises: {
                include: { exercise: { select: { name: true, primaryMuscle: true } } },
              },
              _count: { select: { personalRecords: true } },
            },
          }),
        ]);

      const volumeChange = lastWeek._sum.totalVolume
        ? (((thisWeek._sum.totalVolume ?? 0) - (lastWeek._sum.totalVolume ?? 0)) / (lastWeek._sum.totalVolume ?? 1)) * 100
        : 0;

      statsData = {
        thisWeek: { volume: thisWeek._sum.totalVolume ?? 0, workouts: thisWeek._count },
        lastWeek: { volume: lastWeek._sum.totalVolume ?? 0, workouts: lastWeek._count },
        total: { volume: total._sum.totalVolume ?? 0, workouts: total._count },
        volumeChange: Math.round(volumeChange),
        streak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
      };

      recentWorkouts = recentSessions;

      for (const s of sessions) {
        const day = format(s.startedAt, "yyyy-MM-dd");
        heatmapData[day] = { volume: (heatmapData[day]?.volume ?? 0) + s.totalVolume };
      }
    } catch {
      // DB unavailable — dashboard renders with empty state, API routes will retry client-side
    }
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <DashboardHeader user={session?.user ?? {}} />

      <QuickStart />

      <TodayPlanCard />

      <StatsGrid initialData={statsData ?? undefined} />

      <WeeklyHeatmap initialData={Object.keys(heatmapData).length ? heatmapData : undefined} />

      <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
        <InsightCard />
      </Suspense>

      <RecentWorkouts initialData={recentWorkouts ?? undefined} />
    </div>
  );
}
