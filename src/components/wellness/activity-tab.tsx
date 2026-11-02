"use client";

import { useCallback, useMemo } from "react";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { formatKm } from "@/lib/run/format";
import { STEPS_GOAL, lastDays, stepsSummary } from "@/lib/wellness/insights";
import type { WellnessResponse } from "@/lib/wellness/types";
import { DayBars } from "./charts";
import { dayLabel, useDayIndex } from "./queries";
import { RangeTrend } from "./range-trend";

const steps = (n: number) => n.toLocaleString("it-IT");

export function ActivityTab({ data }: { data: WellnessResponse }) {
  const index = useDayIndex(data.days);
  const summary = useMemo(() => stepsSummary(data.days), [data.days]);
  const month = useMemo(() => lastDays(30).map((d) => ({ date: d, day: index.get(d) })), [index]);
  const stepsOf = useCallback((d: string) => index.get(d)?.steps || null, [index]);

  if (summary.avg30 == null) return <EmptyState>Nessun passo registrato negli ultimi 30 giorni.</EmptyState>;

  const today = month.at(-1)?.day;

  return (
    <div className="space-y-5">
      <Section title="Oggi">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Passi" value={summary.today != null ? steps(summary.today) : "—"} />
          <Stat label="Distanza" value={today?.distance ? formatKm(today.distance) : "—"} unit={today?.distance ? "km" : undefined} />
          <Stat label="Calorie" value={today?.activeCalories ? Math.round(today.activeCalories) : "—"} unit={today?.activeCalories ? "kcal" : undefined} />
        </div>
      </Section>

      <Section title="Ultimi 30 giorni">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Media 7 gg" value={summary.avg7 != null ? steps(summary.avg7) : "—"} />
          <Stat label="Media 30 gg" value={steps(summary.avg30)} />
          <Stat label="Record" value={summary.best ? steps(summary.best.steps) : "—"} detail={summary.best ? dayLabel(summary.best.date) : undefined} />
        </div>
        <DayBars
          goal={STEPS_GOAL}
          bars={month.map(({ date, day }) => ({
            key: date,
            label: dayLabel(date),
            value: day?.steps ?? null,
            caption: day?.steps != null ? `${steps(day.steps)} passi` : "nessun dato",
            highlight: (day?.steps ?? 0) >= STEPS_GOAL,
          }))}
        />
      </Section>

      <Section title="Andamento">
        <RangeTrend value={stepsOf} unit="passi" tone="ink" reference={STEPS_GOAL} referenceLabel="obiettivo" />
      </Section>
    </div>
  );
}
