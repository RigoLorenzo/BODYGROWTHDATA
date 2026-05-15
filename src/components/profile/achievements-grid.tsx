"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const tierColors: Record<string, string> = {
  BRONZE: "border-orange-600/40 bg-orange-600/10",
  SILVER: "border-gray-400/40 bg-gray-400/10",
  GOLD: "border-yellow-400/40 bg-yellow-400/10",
  PLATINUM: "border-cyan-400/40 bg-cyan-400/10",
  DIAMOND: "border-blue-400/40 bg-blue-400/10",
};

export function AchievementsGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch("/api/achievements");
      if (!res.ok) return { unlocked: [], locked: [] };
      return res.json();
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const allAchievements = [...(data?.unlocked ?? []), ...(data?.locked ?? [])];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Achievements ({data?.unlocked?.length ?? 0}/{allAchievements.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {allAchievements.slice(0, 12).map((ach: any) => (
            <div
              key={ach.id}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl border text-center",
                ach.completed ? tierColors[ach.tier] : "border-border/30 bg-muted/20 opacity-40"
              )}
              title={ach.name}
            >
              <span className="text-2xl">{ach.iconEmoji}</span>
              <span className="text-[9px] leading-tight font-medium line-clamp-2">{ach.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
