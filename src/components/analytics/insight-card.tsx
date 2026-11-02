"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  type: string;
  severity: "warning" | "success" | "info" | string;
  title: string;
  body: string;
}

const TONE: Record<string, { icon: LucideIcon; className: string }> = {
  warning: { icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  success: { icon: CheckCircle2, className: "bg-lime-500/15 text-lime-700 dark:text-lime-400" },
  info: { icon: Lightbulb, className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
};

/** Il suggerimento più importante del momento, uno solo: niente da leggere se non serve */
export function InsightCard() {
  const { data: insights } = useQuery<Insight[]>({
    queryKey: ["insights"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/insights");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
  });

  const insight = insights?.[0];
  if (!insight) return null;
  const { icon: Icon, className } = TONE[insight.severity] ?? TONE.info;

  return (
    <section className="flex items-start gap-3 rounded-3xl border border-border/60 bg-card p-4" aria-label="Suggerimento">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", className)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{insight.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
      </div>
    </section>
  );
}
