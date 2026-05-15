"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export function VolumeChart() {
  const { data: heatmap, isLoading } = useQuery({
    queryKey: ["analytics", "heatmap", new Date().getFullYear()],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?type=heatmap&year=${new Date().getFullYear()}`);
      if (!res.ok) return {};
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const day = subDays(new Date(), 29 - i);
    const dateStr = format(day, "yyyy-MM-dd");
    const data = (heatmap as any)?.[dateStr];
    return {
      date: format(day, "d MMM", { locale: it }),
      volume: data?.volume ?? 0,
    };
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Volume Giornaliero (30 giorni)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={last30Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v > 0 ? `${(v / 1000).toFixed(1)}t` : "0"}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={(v: number) => [`${v.toFixed(0)} kg`, "Volume"]}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#volumeGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
