"use client";

import { useMemo } from "react";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { formatKm } from "@/lib/run/format";
import { STEPS_GOAL, lastDays, stepsSummary } from "@/lib/wellness/insights";
import type { WellnessResponse } from "@/lib/wellness/types";
import { DayBars } from "./charts";
import { dayLabel, useDayIndex } from "./queries";

const steps = (n: number) => n.toLocaleString("it-IT");

export function ActivityTab({ data }: { data: WellnessResponse }) {
  const index = useDayIndex(data.days);
  const summary = useMemo(() => stepsSummary(data.days), [data.days]);
  const month = useMemo(() => lastDays(30).map((d) => ({ date: d, day: index.get(d) })), [index]);

  if (summary.avg30 == null) return <EmptyState>Nessun passo registrato negli ultimi 30 giorni.</EmptyState>;

  const today = month.at(-1)?.day;
  const progress = Math.min(100, ((summary.today ?? 0) / STEPS_GOAL) * 100);
  const withKcal = month.filter((m) => m.day?.activeCalories);
  const avgKcal = withKcal.length ? withKcal.reduce((s, m) => s + m.day!.activeCalories!, 0) / withKcal.length : null;

  return (
    <div className="space-y-5">
      <Section title="Oggi" hint={`Obiettivo ${steps(STEPS_GOAL)} passi`}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Passi" value={summary.today != null ? steps(summary.today) : "—"} />
          <Stat label="Distanza" value={today?.distance ? formatKm(today.distance) : "—"} unit={today?.distance ? "km" : undefined} />
          <Stat label="Calorie" value={today?.activeCalories ? Math.round(today.activeCalories) : "—"} unit={today?.activeCalories ? "kcal" : undefined} />
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-foreground" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {progress >= 100 ? "Obiettivo raggiunto" : `Mancano ${steps(Math.max(0, STEPS_GOAL - (summary.today ?? 0)))} passi`}
        </p>
      </Section>

      <Section title="Ultimi 30 giorni" hint="Linea: obiettivo giornaliero">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Media 7 gg" value={summary.avg7 != null ? steps(summary.avg7) : "—"} />
          <Stat label="Media 30 gg" value={steps(summary.avg30)} />
          <Stat label="Obiettivo" value={summary.goalDays30} detail="giorni raggiunto" />
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
        <p className="mt-3 text-xs text-muted-foreground">
          {summary.best && `Giorno migliore: ${dayLabel(summary.best.date)} con ${steps(summary.best.steps)} passi. `}
          {avgKcal != null && `Calorie attive in media: ${Math.round(avgKcal)} kcal al giorno.`}
        </p>
      </Section>
    </div>
  );
}
