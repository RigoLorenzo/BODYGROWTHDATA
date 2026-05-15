"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { getMuscleLabel, formatVolume } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function MuscleBalanceChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "muscle-balance"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-balance");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const chartData = (data ?? []).map((d: { muscle: string; volume: number }) => ({
    muscle: getMuscleLabel(d.muscle),
    volume: d.volume,
  }));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Distribuzione Volume Muscolare</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="muscle" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Radar dataKey="volume" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Completa almeno un allenamento per vedere i dati
          </div>
        )}

        {data?.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {(data as { muscle: string; volume: number }[])
              .sort((a, b) => b.volume - a.volume)
              .slice(0, 5)
              .map((d) => (
                <div key={d.muscle} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{getMuscleLabel(d.muscle)}</span>
                  <span className="font-medium tabular-nums">{formatVolume(d.volume)}</span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
