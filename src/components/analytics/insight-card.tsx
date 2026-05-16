"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function InsightCard() {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/insights");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  if (!insights?.length) return null;

  const insight = insights[0];
  const Icon = insight.type === "plateau" ? AlertTriangle : insight.type === "overtraining" ? AlertTriangle : Info;
  const iconColor = insight.severity === "warning" ? "text-yellow-400" : insight.severity === "success" ? "text-green-400" : "text-blue-400";
  const bgColor = insight.severity === "warning" ? "bg-yellow-400/10 border-yellow-400/20" : insight.severity === "success" ? "bg-green-400/10 border-green-400/20" : "bg-blue-400/10 border-blue-400/20";

  return (
    <Card className={`border ${bgColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm">{insight.title}</p>
              <Badge variant={insight.severity === "warning" ? "warning" : "success"} className="text-[10px]">
                AI Insight
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
