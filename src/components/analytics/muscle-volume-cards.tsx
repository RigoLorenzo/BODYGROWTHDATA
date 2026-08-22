"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMuscleColor, getMuscleLabel, formatVolume, cn } from "@/lib/utils";

interface MuscleEntry {
  muscle: string;
  directSets: number;
  indirectSets: number;
  effectiveSets: number;
  tonnage: number;
  volume: number;
}

/**
 * Una scheda per muscolo con le serie che ha ricevuto nelle ultime 8 settimane:
 * dirette, indirette, efficaci e Volume Load attribuito.
 */
export function MuscleVolumeCards() {
  const { data, isLoading } = useQuery<MuscleEntry[]>({
    queryKey: ["analytics", "muscle-balance"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-balance");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const entries = (data ?? []).filter((d) => d.directSets + d.indirectSets > 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Serie per Muscolo</CardTitle>
          <span className="text-xs text-muted-foreground">ultime 8 settimane</span>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Completa un allenamento per vedere le serie per muscolo
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {entries.map((entry) => (
              <div key={entry.muscle} className={cn("p-2.5 rounded-xl bg-muted/30")}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="h-8 w-1 rounded-full shrink-0"
                    style={{ background: getMuscleColor(entry.muscle) }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{getMuscleLabel(entry.muscle)}</p>
                    <p className="text-lg font-bold tabular-nums leading-tight">
                      {entry.effectiveSets}
                      <span className="text-[10px] font-normal text-muted-foreground"> serie eff.</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {entry.directSets} dirette · {entry.indirectSets} indirette
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {formatVolume(entry.tonnage)} di carico
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
