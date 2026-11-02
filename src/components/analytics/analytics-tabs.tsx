"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendsTab } from "./trends-tab";
import { MuscleFrequencyGrid } from "./muscle-frequency-grid";
import { MuscleStatsGrid } from "./muscle-stats-grid";
import { RecordsTab } from "./records-tab";
import { RunTab } from "./run-tab";
import { SummaryTab } from "./summary-tab";
import { TabStrip, useUrlTab } from "./tab-strip";
import { WorkloadStats } from "./workload-stats";

// I grafici recharts si scaricano solo quando apri la scheda che li usa
const chartFallback = () => <Skeleton className="h-64 rounded-3xl" />;
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

const TABS = [
  { value: "riepilogo", label: "Riepilogo" },
  { value: "andamento", label: "Andamento" },
  { value: "record", label: "Record" },
  { value: "volume", label: "Volume" },
  { value: "muscoli", label: "Muscoli" },
  { value: "corsa", label: "Corsa" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case "andamento":
      return <TrendsTab />;
    case "volume":
      return (
        <div className="space-y-5">
          <WorkloadStats />
          <WeeklyLoadChart />
        </div>
      );
    case "muscoli":
      return (
        <div className="space-y-5">
          <MuscleFrequencyGrid />
          <MuscleStatsGrid />
          <MuscleBalanceChart />
          <MuscleTrendChart />
        </div>
      );
    case "corsa":
      return <RunTab />;
    case "record":
      return <RecordsTab />;
    default:
      return <SummaryTab />;
  }
}

/** Schede nell'URL (?tab=): i link portano al punto giusto e "indietro" ci ritorna */
export function AnalyticsTabs() {
  // Vecchi nomi: Calendario e Storico ora sono in Andamento, Progressi non c'è più
  const [tab, select] = useUrlTab(TABS, { calendario: "andamento", storico: "andamento", progressi: "riepilogo" });
  return (
    <div className="space-y-5">
      <TabStrip tabs={TABS} value={tab} onChange={select} label="Sezioni di Analytics" />
      <TabContent tab={tab} />
    </div>
  );
}
