"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VolumeChart } from "./volume-chart";
import { StrengthChart } from "./strength-chart";
import { MuscleBalanceChart } from "./muscle-balance-chart";
import { MuscleFrequencyGrid } from "./muscle-frequency-grid";
import { MuscleStatsGrid } from "./muscle-stats-grid";
import { OverviewStats } from "./overview-stats";
import { ProgressScore } from "./progress-score";

export function AnalyticsTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full grid grid-cols-5">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="progress">Progress</TabsTrigger>
        <TabsTrigger value="volume">Volume</TabsTrigger>
        <TabsTrigger value="strength">Forza</TabsTrigger>
        <TabsTrigger value="muscle">Muscoli</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <OverviewStats />
      </TabsContent>

      <TabsContent value="progress" className="mt-4">
        <ProgressScore />
      </TabsContent>

      <TabsContent value="volume" className="mt-4">
        <VolumeChart />
      </TabsContent>

      <TabsContent value="strength" className="mt-4">
        <StrengthChart />
      </TabsContent>

      <TabsContent value="muscle" className="mt-4 space-y-4">
        <MuscleFrequencyGrid />
        <MuscleStatsGrid />
        <MuscleBalanceChart />
      </TabsContent>
    </Tabs>
  );
}
