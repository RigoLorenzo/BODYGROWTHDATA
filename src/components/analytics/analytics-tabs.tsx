"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VolumeChart } from "./volume-chart";
import { StrengthChart } from "./strength-chart";
import { MuscleBalanceChart } from "./muscle-balance-chart";
import { MuscleFrequencyGrid } from "./muscle-frequency-grid";
import { OverviewStats } from "./overview-stats";

export function AnalyticsTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="w-full grid grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="volume">Volume</TabsTrigger>
        <TabsTrigger value="strength">Forza</TabsTrigger>
        <TabsTrigger value="muscle">Muscoli</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <OverviewStats />
      </TabsContent>

      <TabsContent value="volume" className="mt-4">
        <VolumeChart />
      </TabsContent>

      <TabsContent value="strength" className="mt-4">
        <StrengthChart />
      </TabsContent>

      <TabsContent value="muscle" className="mt-4 space-y-4">
        <MuscleFrequencyGrid />
        <MuscleBalanceChart />
      </TabsContent>
    </Tabs>
  );
}
