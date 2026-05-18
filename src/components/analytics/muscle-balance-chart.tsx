"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { getMuscleLabel, formatVolume } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MuscleEntry { muscle: string; tonnage: number; volume: number }

export function MuscleBalanceChart() {
  const [metric, setMetric] = useState<"tonnage" | "volume">("tonnage");

  const { data, isLoading } = useQuery<MuscleEntry[]>({
    queryKey: ["analytics", "muscle-balance"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-balance");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const chartData = (data ?? []).map((d) => ({
    muscle: getMuscleLabel(d.muscle),
    value: metric === "tonnage" ? d.tonnage : d.volume,
  }));

  const btnCls = (active: boolean) =>
    cn("text-[10px] px-2 py-0.5 rounded-md transition-colors",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70");

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Distribuzione Muscolare</CardTitle>
          <div className="flex gap-1">
            <button className={btnCls(metric === "tonnage")} onClick={() => setMetric("tonnage")}>
              Tonnellaggio
            </button>
            <button className={btnCls(metric === "volume")} onClick={() => setMetric("volume")}>
              Volume
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="muscle" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Radar dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Completa almeno un allenamento per vedere i dati
          </div>
        )}

        {(data?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              {metric === "tonnage" ? "Tonnellaggio (kg)" : "Volume (reps)"}
            </p>
            {(data ?? [])
              .slice()
              .sort((a, b) => (metric === "tonnage" ? b.tonnage - a.tonnage : b.volume - a.volume))
              .slice(0, 6)
              .map((d) => (
                <div key={d.muscle} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{getMuscleLabel(d.muscle)}</span>
                  <span className="font-medium tabular-nums">
                    {metric === "tonnage" ? formatVolume(d.tonnage) : `${d.volume.toLocaleString()} reps`}
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
