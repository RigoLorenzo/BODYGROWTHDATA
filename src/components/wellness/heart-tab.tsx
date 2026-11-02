"use client";

import { useCallback, useMemo } from "react";
import { useActivity } from "@/components/analytics/use-activity";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { mainSleeps, restingTrend, sleepByTraining } from "@/lib/wellness/insights";
import type { WellnessResponse } from "@/lib/wellness/types";
import { useDayIndex } from "./queries";
import { RangeTrend } from "./range-trend";

export function HeartTab({ data }: { data: WellnessResponse }) {
  const { data: activity = [] } = useActivity();
  const index = useDayIndex(data.days);

  const trend = useMemo(() => restingTrend(data.days), [data.days]);
  const nights = useMemo(() => new Map(mainSleeps(data.sleeps).map((n) => [n.date, n])), [data.sleeps]);
  const restingOf = useCallback((d: string) => index.get(d)?.restingHr ?? null, [index]);
  const dailyAvgOf = useCallback((d: string) => index.get(d)?.avgHr ?? null, [index]);
  const sleepHrOf = useCallback((d: string) => nights.get(d)?.avgHr ?? null, [nights]);
  const recovery = useMemo(
    () => sleepByTraining(data.sleeps, activity, data.days).filter((g) => g.restingHr != null && g.nights >= 2),
    [data, activity]
  );
  const rest = recovery.find((g) => g.key === "rest");

  if (!data.days.some((d) => d.restingHr != null || d.avgHr != null)) {
    return <EmptyState>Nessun battito registrato ancora: tieni l&apos;orologio al polso con il monitoraggio continuo attivo.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <Section title="FC a riposo">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Oggi" value={trend.latest ?? "—"} unit="bpm" />
          <Stat label="Media 30 gg" value={trend.baseline != null ? Math.round(trend.baseline) : "—"} unit="bpm" />
          <Stat
            label="3 mesi"
            value={trend.longTerm != null ? `${trend.longTerm > 0 ? "+" : trend.longTerm < 0 ? "−" : ""}${Math.round(Math.abs(trend.longTerm))}` : "—"}
            unit="bpm"
          />
        </div>
        <div className="mt-4">
          <RangeTrend value={restingOf} unit="bpm" reference={trend.baseline} />
        </div>
      </Section>

      {data.days.some((d) => d.avgHr != null) && (
        <Section title="FC media del giorno">
          <RangeTrend value={dailyAvgOf} unit="bpm" />
        </Section>
      )}

      {[...nights.values()].some((n) => n.avgHr != null) && (
        <Section title="FC durante il sonno">
          <RangeTrend value={sleepHrOf} unit="bpm" tone="indigo" />
        </Section>
      )}

      {rest && recovery.length > 1 && (
        <Section title="FC a riposo dopo l'allenamento">
          <ul className="space-y-2.5">
            {recovery.map((g) => {
              const diff = g.key === "rest" ? null : g.restingHr! - rest.restingHr!;
              return (
                <li key={g.key} className="flex items-center justify-between text-sm">
                  <span>
                    {g.label} <span className="text-xs text-muted-foreground">· {g.nights} notti</span>
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{Math.round(g.restingHr!)} bpm</span>
                    {diff != null && Math.abs(diff) >= 1 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {diff > 0 ? "+" : "−"}
                        {Math.round(Math.abs(diff))}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
