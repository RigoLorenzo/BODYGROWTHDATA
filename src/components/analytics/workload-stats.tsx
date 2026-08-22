"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Target, CalendarCheck, Weight } from "lucide-react";
import { formatVolume } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";

/**
 * Schede di riepilogo del carico degli ultimi 28 giorni: serie di lavoro e
 * serie efficaci (Muscle Volume) accanto al tonnellaggio (Volume Load).
 */
export function WorkloadStats() {
  const { data, isLoading } = useQuery<WeeklyAnalytics>({
    queryKey: ["analytics", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=weekly&weeks=8");
      if (!res.ok) throw new Error("Failed to fetch weekly analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

  // Ultime 4 settimane = finestra di 28 giorni, la stessa del Progress Score
  const lastFour = (data?.weeks ?? []).slice(-4);
  const workingSets = lastFour.reduce((sum, w) => sum + w.workingSets, 0);
  const effectiveSets = lastFour.reduce(
    (sum, w) => sum + Object.values(w.effectiveSetsByMuscle ?? {}).reduce((a, b) => a + b, 0),
    0
  );
  const tonnage = lastFour.reduce((sum, w) => sum + w.tonnage, 0);

  const cards = [
    {
      icon: Layers,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      value: workingSets.toLocaleString(),
      label: "Serie di lavoro (28gg)",
    },
    {
      icon: Target,
      color: "text-green-400",
      bg: "bg-green-400/10",
      value: Math.round(effectiveSets * 10) / 10,
      label: "Serie efficaci (28gg)",
    },
    {
      icon: CalendarCheck,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      value: data?.trainingFrequency ?? 0,
      label: "Allenamenti a settimana",
    },
    {
      icon: Weight,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      value: formatVolume(tonnage),
      label: "Volume Load (28gg)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
