"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMuscleColor, getMuscleLabel, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MuscleFreq {
  count: number;
  lastWorked: string | null;
  daysSince: number | null;
}

function getColor(daysSince: number | null, count: number) {
  if (count === 0 || daysSince === null) return { bg: "bg-muted/30", text: "text-muted-foreground", dot: "bg-muted-foreground/30" };
  if (daysSince <= 2) return { bg: "bg-green-500/15", text: "text-green-400", dot: "bg-green-500" };
  if (daysSince <= 5) return { bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-500" };
  return { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-500" };
}

function dayLabel(daysSince: number | null): string {
  if (daysSince === null) return "Mai";
  if (daysSince === 0) return "Oggi";
  if (daysSince === 1) return "Ieri";
  return `${daysSince}gg fa`;
}

export function MuscleFrequencyGrid() {
  const { data, isLoading } = useQuery<Record<string, MuscleFreq>>({
    queryKey: ["analytics", "muscle-frequency"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-frequency&days=14");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Frequenza Muscolare (14 giorni)</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 rounded-lg" /></CardContent>
      </Card>
    );
  }

  const muscles = [
    "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS",
    "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Frequenza Muscolare</CardTitle>
          <span className="text-xs text-muted-foreground">ultimi 14 giorni</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {muscles.map((m) => {
            const freq = data?.[m] ?? { count: 0, lastWorked: null, daysSince: null };
            const colors = getColor(freq.daysSince, freq.count);
            return (
              <div
                key={m}
                className={cn("flex items-center gap-2.5 p-2.5 rounded-xl transition-colors", colors.bg)}
              >
                <div
                  className="h-8 w-1 rounded-full shrink-0"
                  style={{ background: getMuscleColor(m) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{getMuscleLabel(m)}</p>
                  <p className={cn("text-[10px]", colors.text)}>
                    {freq.count > 0 ? `${freq.count}× · ${dayLabel(freq.daysSince)}` : "Non allenato"}
                  </p>
                </div>
                {freq.count > 0 && (
                  <div className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 px-1">
          {[
            { dot: "bg-green-500", label: "≤ 2gg" },
            { dot: "bg-yellow-500", label: "3–5gg" },
            { dot: "bg-red-500", label: "6+gg" },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn("h-2 w-2 rounded-full", dot)} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
