"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMuscleColor, getMuscleLabel, formatVolume, cn } from "@/lib/utils";

interface MuscleStats {
  totalSets: number;
  totalReps: number;
  tonnage: number;
  volume: number;
  directSets: number;
  indirectSets: number;
  effectiveSets: number;
}

type Metric = "effective" | "direct" | "reps" | "tonnage";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS",
  "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
];

export function MuscleStatsGrid() {
  const [metric, setMetric] = useState<Metric>("effective");

  const { data, isLoading } = useQuery<Record<string, MuscleStats>>({
    queryKey: ["analytics", "muscle-stats"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-stats&weeks=8");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const getValue = (stats: MuscleStats | undefined): number => {
    if (!stats) return 0;
    if (metric === "effective") return stats.effectiveSets ?? 0;
    if (metric === "direct") return stats.directSets ?? stats.totalSets;
    if (metric === "reps") return stats.totalReps;
    return stats.tonnage;
  };

  const allValues = MUSCLES.map((m) => getValue(data?.[m]));
  const maxValue = Math.max(...allValues, 1);

  const formatValue = (v: number) => {
    if (metric === "tonnage") return formatVolume(v);
    if (metric === "effective") return `${v} serie`;
    if (metric === "direct") return `${v} serie`;
    return v.toLocaleString();
  };

  const btnCls = (active: boolean) =>
    cn("text-[10px] px-2 py-0.5 rounded-md transition-colors",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70");

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Volume muscolare</CardTitle>
          <div className="flex gap-1">
            <button className={btnCls(metric === "effective")} onClick={() => setMetric("effective")}>Efficaci</button>
            <button className={btnCls(metric === "direct")} onClick={() => setMetric("direct")}>Dirette</button>
            <button className={btnCls(metric === "reps")} onClick={() => setMetric("reps")}>Reps</button>
            <button className={btnCls(metric === "tonnage")} onClick={() => setMetric("tonnage")}>Tonn.</button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Ultime 8 settimane ·{" "}
          {metric === "effective"
            ? "serie pesate per contributo del muscolo e vicinanza al cedimento"
            : metric === "direct"
              ? "serie in cui il muscolo è il primario"
              : metric === "tonnage"
                ? "Volume Load attribuito al muscolo"
                : "ripetizioni attribuite al muscolo"}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <div className="space-y-2">
            {MUSCLES.map((muscle) => {
              const stats = data?.[muscle];
              const value = getValue(stats);
              const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
              const color = getMuscleColor(muscle);

              return (
                <div key={muscle} className="flex items-center gap-3">
                  <p className="text-[11px] text-muted-foreground w-20 shrink-0 truncate">
                    {getMuscleLabel(muscle)}
                  </p>
                  <div className="flex-1 relative">
                    <div className="h-5 rounded-md bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{ width: `${barWidth}%`, background: `${color}70` }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold tabular-nums w-16 text-right shrink-0">
                    {value > 0 ? formatValue(value) : <span className="text-muted-foreground">—</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && data && (
          <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
            {[
              { label: "Serie tot.", value: Object.values(data).reduce((s, d) => s + d.totalSets, 0).toString() },
              { label: "Reps tot.", value: Object.values(data).reduce((s, d) => s + d.totalReps, 0).toLocaleString() },
              { label: "Tonnellaggio", value: formatVolume(Object.values(data).reduce((s, d) => s + d.tonnage, 0)) },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-sm font-bold tabular-nums">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
