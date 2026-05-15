"use client";

import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Flame, Dumbbell, Target, Zap } from "lucide-react";
import { formatVolume } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsGrid() {
  const { data, isLoading } = useAnalyticsOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

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
          <CardContent className="p-4">
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
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.sub ?? stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
