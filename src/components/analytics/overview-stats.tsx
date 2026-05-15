"use client";

import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVolume } from "@/lib/utils";
import { Flame, Trophy, Dumbbell, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewStats() {
  const { data, isLoading } = useAnalyticsOverview();

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-400/10">
              <Flame className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{data?.streak ?? 0}</p>
              <p className="text-xs text-muted-foreground">Streak attuale</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <Trophy className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{data?.longestStreak ?? 0}</p>
              <p className="text-xs text-muted-foreground">Streak record</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-400/10">
              <Dumbbell className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{data?.total?.workouts ?? 0}</p>
              <p className="text-xs text-muted-foreground">Allenamenti totali</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-400/10">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatVolume(data?.total?.volume ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Volume totale</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Questa settimana vs precedente</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Questa settimana</p>
              <p className="text-xl font-bold tabular-nums">{data?.thisWeek?.workouts ?? 0} allenamenti</p>
              <p className="text-sm text-muted-foreground">{formatVolume(data?.thisWeek?.volume ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Settimana scorsa</p>
              <p className="text-xl font-bold tabular-nums">{data?.lastWeek?.workouts ?? 0} allenamenti</p>
              <p className="text-sm text-muted-foreground">{formatVolume(data?.lastWeek?.volume ?? 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
