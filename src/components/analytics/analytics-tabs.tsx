"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CalendarTab } from "./calendar-tab";
import { MuscleFrequencyGrid } from "./muscle-frequency-grid";
import { MuscleStatsGrid } from "./muscle-stats-grid";
import { ProgressScore } from "./progress-score";
import { RunTab } from "./run-tab";
import { SummaryTab } from "./summary-tab";
import { WorkloadStats } from "./workload-stats";

// I grafici recharts si scaricano solo quando apri la scheda che li usa
const chartFallback = () => <Skeleton className="h-64 rounded-3xl" />;
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

const TABS = [
  { value: "riepilogo", label: "Riepilogo" },
  { value: "calendario", label: "Calendario" },
  { value: "progressi", label: "Progressi" },
  { value: "volume", label: "Volume" },
  { value: "muscoli", label: "Muscoli" },
  { value: "corsa", label: "Corsa" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function TabContent({ tab }: { tab: Tab }) {
  switch (tab) {
    case "calendario":
      return <CalendarTab />;
    case "progressi":
      return (
        <div className="space-y-5">
          <ProgressScore />
          <StrengthChart />
        </div>
      );
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
    default:
      return <SummaryTab />;
  }
}

/** Schede nell'URL (?tab=): i link portano al punto giusto e "indietro" ci ritorna */
export function AnalyticsTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("tab");
  const tab: Tab = TABS.some((t) => t.value === requested) ? (requested as Tab) : "riepilogo";
  const active = useRef<HTMLButtonElement>(null);

  // La scheda scelta resta visibile nella barra scorrevole
  useEffect(() => {
    active.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);

  const select = (value: Tab) => {
    const next = new URLSearchParams(params);
    if (value === "riepilogo") next.delete("tab");
    else next.set("tab", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div role="tablist" aria-label="Sezioni di Analytics" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.value}
              ref={t.value === tab ? active : undefined}
              role="tab"
              aria-selected={t.value === tab}
              onClick={() => select(t.value)}
              className={cn(
                "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                t.value === tab ? "bg-foreground text-background" : "bg-muted text-muted-foreground active:bg-muted/70"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <TabContent tab={tab} />
    </div>
  );
}
