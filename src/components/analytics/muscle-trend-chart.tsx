"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getMuscleColor, getMuscleLabel, cn } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS",
  "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
];

/** Andamento su 8 settimane delle serie efficaci di un muscolo. */
export function MuscleTrendChart() {
  const [muscle, setMuscle] = useState("CHEST");

  const { data, isLoading } = useQuery<WeeklyAnalytics>({
    queryKey: ["analytics", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=weekly&weeks=8");
      if (!res.ok) throw new Error("Failed to fetch weekly analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const chartData = (data?.weeks ?? []).map((w) => ({
    label: w.label,
    effective: w.effectiveSetsByMuscle?.[muscle] ?? 0,
    direct: w.directSetsByMuscle?.[muscle] ?? 0,
  }));

  const total = chartData.reduce((sum, w) => sum + w.effective, 0);
  const color = getMuscleColor(muscle);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Trend Muscolo (8 settimane)</CardTitle>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-2">
          {MUSCLES.map((m) => (
            <button
              key={m}
              onClick={() => setMuscle(m)}
              className={cn(
                "shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-colors",
                muscle === m ? "border-transparent text-white" : "border-border text-muted-foreground"
              )}
              style={muscle === m ? { background: getMuscleColor(m) } : {}}
            >
              {getMuscleLabel(m)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v: number, name) => [
                `${v} serie`,
                name === "effective" ? "Efficaci" : "Dirette",
              ]}
            />
            <Line dataKey="effective" stroke={color} strokeWidth={2} dot={{ r: 2 }} />
            <Line dataKey="direct" stroke={color} strokeWidth={1} strokeDasharray="4 3" dot={false} opacity={0.6} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {getMuscleLabel(muscle)}: {Math.round(total * 10) / 10} serie efficaci in 8 settimane · linea
          tratteggiata = serie dirette
        </p>
      </CardContent>
    </Card>
  );
}
