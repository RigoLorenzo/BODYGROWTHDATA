import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecentWorkouts } from "@/components/dashboard/recent-workouts";
import { WeeklyHeatmap } from "@/components/calendar/weekly-heatmap";
import { QuickStart } from "@/components/session/quick-start";
import { InsightCard } from "@/components/analytics/insight-card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <DashboardHeader user={session!.user} />

      <QuickStart />

      <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}>
        <StatsGrid />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
        <WeeklyHeatmap />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
        <InsightCard />
      </Suspense>

      <Suspense fallback={<div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}>
        <RecentWorkouts />
      </Suspense>
    </div>
  );
}
