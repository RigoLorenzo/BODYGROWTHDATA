"use client";

import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, endOfWeek, format, isSameDay, isFuture, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { Flame } from "lucide-react";
import { useHeatmapData } from "@/hooks/use-workout-session";
import { useActiveProgram } from "@/hooks/use-active-program";
import { cn, formatVolume } from "@/lib/utils";
import type { AnalyticsOverview } from "@/types";

interface Props {
  initialOverview?: AnalyticsOverview;
  initialDays?: Record<string, { volume: number }>;
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1 font-display text-2xl font-bold tabular-nums leading-tight">
        {children}
      </div>
    </div>
  );
}

/** La settimana in corso: sedute fatte rispetto al piano, volume e costanza */
export function WeekCard({ initialOverview, initialDays }: Props) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(today, { weekStartsOn: 1 }) });

  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=overview");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    initialData: initialOverview,
  });
  // A cavallo di capodanno la settimana tocca due anni. Niente initialData qui:
  // la cache dell'anno è condivisa col calendario e deve restare completa.
  const { data: startYear } = useHeatmapData(weekStart.getFullYear());
  const { data: currentYear } = useHeatmapData(today.getFullYear());
  const { data: plan } = useActiveProgram();

  const trained = (day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    const loaded = startYear || currentYear;
    return loaded ? !!(startYear?.[key] ?? currentYear?.[key]) : !!initialDays?.[key];
  };

  const workouts = overview?.thisWeek.workouts ?? 0;
  const target = plan?.program.frequency;

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Questa settimana</h2>
        <p className="text-xs text-muted-foreground capitalize">
          {format(weekStart, "d MMM", { locale: it })} – {format(days[6], "d MMM", { locale: it })}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const done = trained(day);
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "text-[11px] font-medium uppercase",
                  isToday ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {format(day, "EEEEE", { locale: it })}
              </span>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full font-display text-base font-bold tabular-nums",
                  done && "bg-foreground text-background",
                  !done && isToday && "ring-2 ring-foreground",
                  !done && !isToday && (isFuture(day) ? "text-muted-foreground/50" : "bg-muted text-muted-foreground")
                )}
              >
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-4">
        <Metric label="Sedute">
          {workouts}
          {target ? <span className="text-base text-muted-foreground">/{target}</span> : null}
        </Metric>
        {/* Niente confronto in percentuale: a metà settimana sarebbe sempre negativo */}
        <Metric label="Volume">{formatVolume(overview?.thisWeek.volume ?? 0)}</Metric>
        <Metric label="Streak">
          {overview?.streak ?? 0}
          <Flame className={cn("h-4 w-4", (overview?.streak ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground")} />
        </Metric>
      </div>
    </section>
  );
}
