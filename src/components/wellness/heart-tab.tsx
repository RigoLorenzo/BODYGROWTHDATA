"use client";

import { useCallback, useMemo, useState } from "react";
import { useActivity } from "@/components/analytics/use-activity";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { cn } from "@/lib/utils";
import { lastDays, mainSleeps, restingTrend, sleepByTraining } from "@/lib/wellness/insights";
import type { WellnessResponse } from "@/lib/wellness/types";
import { HourlyHeartRate } from "./charts";
import { heartDetail } from "./format";
import { dayLabel, longDayLabel, useDayIndex } from "./queries";
import { RangeTrend } from "./range-trend";

/** Lettura del trend di lungo periodo della FC a riposo */
function longTermText(change: number | null): string | null {
  if (change == null) return null;
  if (change <= -2) return `−${Math.round(-change)} bpm in tre mesi: il cuore lavora meno a riposo, segno che la forma aerobica migliora.`;
  if (change >= 3) return `+${Math.round(change)} bpm in tre mesi: possibile stanchezza accumulata, stress o poco sonno.`;
  return "Stabile negli ultimi tre mesi.";
}

export function HeartTab({ data }: { data: WellnessResponse }) {
  const { data: activity = [] } = useActivity();
  const index = useDayIndex(data.days);
  const week = useMemo(() => lastDays(7).filter((d) => index.get(d)?.hrHourly?.length).reverse(), [index]);
  const [selected, setSelected] = useState<string | null>(null);
  const day = index.get(selected ?? week[0] ?? "");

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
      <Section title="FC a riposo" hint="Il battito più basso da sveglio: scende quando sei allenato e riposato">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Oggi" value={trend.latest ?? "—"} unit="bpm" detail={heartDetail(trend.delta)} />
          <Stat label="Tua norma" value={trend.baseline != null ? Math.round(trend.baseline) : "—"} unit="bpm" detail="30 giorni" />
          <Stat
            label="3 mesi"
            value={trend.longTerm != null ? `${trend.longTerm > 0 ? "+" : trend.longTerm < 0 ? "−" : ""}${Math.round(Math.abs(trend.longTerm))}` : "—"}
            unit="bpm"
          />
        </div>
        <div className="mt-4">
          <RangeTrend value={restingOf} unit="bpm" reference={trend.baseline} />
        </div>
        {longTermText(trend.longTerm) && <p className="mt-3 text-sm text-muted-foreground">{longTermText(trend.longTerm)}</p>}
      </Section>

      {week.length > 0 && day && (
        <Section title="Battiti del giorno" hint={longDayLabel(day.date)}>
          <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {week.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                aria-pressed={d === day.date}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                  d === day.date ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {dayLabel(d)}
              </button>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Minimo" value={day.minHr ?? "—"} unit="bpm" />
            <Stat label="Media" value={day.avgHr ?? "—"} unit="bpm" />
            <Stat label="Massimo" value={day.maxHr ?? "—"} unit="bpm" />
          </div>
          <HourlyHeartRate hours={day.hrHourly ?? []} />
        </Section>
      )}

      {data.days.some((d) => d.avgHr != null) && (
        <Section title="FC media del giorno" hint="Dai battiti al minuto: sale con allenamenti, stress e caldo">
          <RangeTrend value={dailyAvgOf} unit="bpm" />
        </Section>
      )}

      {[...nights.values()].some((n) => n.avgHr != null) && (
        <Section title="FC durante il sonno" hint="Media della notte: alta dopo allenamenti duri, alcol o malanni in arrivo">
          <RangeTrend value={sleepHrOf} unit="bpm" tone="indigo" />
        </Section>
      )}

      {rest && recovery.length > 1 && (
        <Section title="Recupero" hint="FC a riposo del mattino dopo, in base all'allenamento del giorno prima">
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
          <p className="mt-3 text-xs text-muted-foreground">
            Un aumento di 1-3 bpm il giorno dopo è normale; oltre 5 bpm per più giorni indica che il recupero non sta tenendo il passo.
          </p>
        </Section>
      )}
    </div>
  );
}
