"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Sparkles, Target } from "lucide-react";
import type { ProgressScoreResult, ProgressCategoryKey } from "@/lib/progress-score";

const CATEGORY_COLOR: Record<ProgressCategoryKey, string> = {
  consistency: "#f97316",
  strength: "#8b5cf6",
  muscleVolume: "#22c55e",
  records: "#eab308",
  body: "#3b82f6",
};

export function ProgressScore() {
  const { data, isLoading } = useQuery<ProgressScoreResult>({
    queryKey: ["analytics", "progress"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=progress");
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  if (!data?.available) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center">
          <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {data?.reason ?? "Non ci sono ancora abbastanza dati per il tuo Progress Score."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const delta = data.delta;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaColor =
    delta == null || delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-green-400" : "text-orange-400";

  return (
    <div className="space-y-4">
      {/* Punteggio */}
      <Card className="border-border/50">
        <CardContent className="p-5 text-center">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Progress Score</p>
          <p className="text-5xl font-bold tabular-nums leading-none">
            {data.score}
            <span className="text-xl font-normal text-muted-foreground"> / 100</span>
          </p>
          <div className={`flex items-center justify-center gap-1.5 mt-2 text-sm ${deltaColor}`}>
            <DeltaIcon className="h-4 w-4" />
            <span className="font-semibold tabular-nums">
              {delta == null
                ? "Nessun periodo precedente da confrontare"
                : `${delta > 0 ? "+" : ""}${delta} rispetto al periodo precedente`}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Ultimi {data.periodDays} giorni, confrontati solo con il tuo storico
          </p>
        </CardContent>
      </Card>

      {/* Insight */}
      {data.insight && (
        <Card className="border bg-blue-400/10 border-blue-400/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-blue-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{data.insight}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categorie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.categories.map((category) => {
            const catDelta =
              category.previousScore != null ? category.score - category.previousScore : null;
            return (
              <div key={category.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CATEGORY_COLOR[category.key] }}
                    />
                    <p className="text-sm font-medium">{category.label}</p>
                    <span className="text-[10px] text-muted-foreground/70">
                      {Math.round(category.weight * 100)}%
                    </span>
                    {catDelta != null && catDelta !== 0 && (
                      <Badge
                        variant={catDelta > 0 ? "success" : "warning"}
                        className="text-[10px] tabular-nums"
                      >
                        {catDelta > 0 ? "+" : ""}
                        {catDelta}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-bold tabular-nums">{category.score}</p>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${category.score}%`, background: CATEGORY_COLOR[category.key] }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{category.detail}</p>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground/70 pt-1">
            Media pesata delle sole categorie con dati sufficienti: quelle mancanti non abbassano il
            punteggio, il loro peso si redistribuisce sulle altre. Il riferimento personale è il
            miglior periodo degli ultimi 6 mesi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
