"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MuscleFrequencyGrid } from "./muscle-frequency-grid";
import { MuscleStatsGrid } from "./muscle-stats-grid";
import { OverviewStats } from "./overview-stats";
import { ProgressScore } from "./progress-score";
import { WorkloadStats } from "./workload-stats";
import { MuscleVolumeCards } from "./muscle-volume-cards";

// I grafici (recharts) si scaricano solo quando apri la scheda che li usa
const chartFallback = () => <Skeleton className="h-64 rounded-xl" />;
const VolumeChart = dynamic(() => import("./volume-chart").then((m) => m.VolumeChart), { ssr: false, loading: chartFallback });
const StrengthChart = dynamic(() => import("./strength-chart").then((m) => m.StrengthChart), { ssr: false, loading: chartFallback });
const MuscleBalanceChart = dynamic(() => import("./muscle-balance-chart").then((m) => m.MuscleBalanceChart), {
  ssr: false,
  loading: chartFallback,
});
const WeeklyLoadChart = dynamic(() => import("./weekly-load-chart").then((m) => m.WeeklyLoadChart), {
  ssr: false,
  loading: chartFallback,
});
const MuscleTrendChart = dynamic(() => import("./muscle-trend-chart").then((m) => m.MuscleTrendChart), {
  ssr: false,
  loading: chartFallback,
});


export function AnalyticsTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full grid grid-cols-5 [&>button]:px-1 [&>button]:text-[13px]">
        <TabsTrigger value="overview">Riepilogo</TabsTrigger>
        <TabsTrigger value="progress">Progressi</TabsTrigger>
        <TabsTrigger value="volume">Volume</TabsTrigger>
        <TabsTrigger value="strength">Forza</TabsTrigger>
        <TabsTrigger value="muscle">Muscoli</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <OverviewStats />
        <WorkloadStats />
      </TabsContent>

      <TabsContent value="progress" className="mt-4">
        <ProgressScore />
      </TabsContent>

      <TabsContent value="volume" className="mt-4 space-y-4">
        <WorkloadStats />
        <VolumeChart />
        <WeeklyLoadChart />
      </TabsContent>

      <TabsContent value="strength" className="mt-4">
        <StrengthChart />
      </TabsContent>

      <TabsContent value="muscle" className="mt-4 space-y-4">
        <MuscleVolumeCards />
        <MuscleFrequencyGrid />
        <MuscleStatsGrid />
        <MuscleBalanceChart />
        <MuscleTrendChart />
      </TabsContent>
    </Tabs>
  );
}
