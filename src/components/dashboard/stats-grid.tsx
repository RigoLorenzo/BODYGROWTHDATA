"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Flame, Dumbbell, Target, Zap } from "lucide-react";
import { formatVolume } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AnalyticsOverview {
  thisWeek: { volume: number; workouts: number };
  lastWeek?: { volume: number; workouts: number };
  total: { volume: number; workouts: number };
  volumeChange: number;
  streak: number;
  longestStreak?: number;
}

interface Props {
  initialData?: AnalyticsOverview;
}

export function StatsGrid({ initialData }: Props) {
  const { data } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=overview");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    initialData,
  });

  const stats = [
    {
      label: "Volume Settimana",
      value: formatVolume(data?.thisWeek?.volume ?? 0),
      change: data?.volumeChange,
      icon: Dumbbell,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Allenamenti",
      value: `${data?.thisWeek?.workouts ?? 0}`,
      sub: "questa settimana",
      icon: Target,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Streak",
      value: `${data?.streak ?? 0}`,
      sub: "giorni consecutivi",
      icon: Flame,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
    },
    {
      label: "Volume Totale",
      value: formatVolume(data?.total?.volume ?? 0),
      sub: `${data?.total?.workouts ?? 0} allenamenti`,
      icon: Zap,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
              {stat.change !== undefined && (
                <div className={cn("flex items-center gap-0.5 text-xs font-medium", stat.change >= 0 ? "text-green-400" : "text-red-400")}>
                  {stat.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stat.change)}%
                </div>
              )}
            </div>
            <p
              className="text-3xl font-black tabular-nums"
              style={{ letterSpacing: "-0.02em" }}
            >
              {stat.value}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70 mt-0.5">
              {stat.sub ?? stat.label}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
