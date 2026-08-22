"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVolume, cn } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";

type Metric = "workingSets" | "tonnage";

/** Carico settimanale: serie di lavoro (volume muscolare) e Volume Load. */
export function WeeklyLoadChart() {
  const [metric, setMetric] = useState<Metric>("workingSets");

  const { data, isLoading } = useQuery<WeeklyAnalytics>({
    queryKey: ["analytics", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=weekly&weeks=8");
      if (!res.ok) throw new Error("Failed to fetch weekly analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const btnCls = (active: boolean) =>
    cn("text-[10px] px-2 py-0.5 rounded-md transition-colors",
      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70");

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const chartData = (data?.weeks ?? []).map((w) => ({
    label: w.label,
    value: metric === "tonnage" ? w.tonnage : w.workingSets,
  }));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Carico Settimanale (8 settimane)</CardTitle>
          <div className="flex gap-1">
            <button className={btnCls(metric === "workingSets")} onClick={() => setMetric("workingSets")}>
              Serie
            </button>
            <button className={btnCls(metric === "tonnage")} onClick={() => setMetric("tonnage")}>
              Tonnellaggio
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              formatter={(v: number) => [
                metric === "tonnage" ? formatVolume(v) : `${v} serie`,
                metric === "tonnage" ? "Volume Load" : "Serie di lavoro",
              ]}
            />
            <Bar dataKey="value" fill={metric === "tonnage" ? "#22c55e" : "#8b5cf6"} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Media {data?.weeklyAverageWorkingSets ?? 0} serie di lavoro a settimana
        </p>
      </CardContent>
    </Card>
  );
}
