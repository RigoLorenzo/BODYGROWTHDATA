"use client";

import { useCallback, useMemo } from "react";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { formatDecimal } from "@/components/analytics/format";
import { lastDays } from "@/lib/wellness/insights";
import type { WellnessResponse } from "@/lib/wellness/types";
import { DayBars } from "./charts";
import { stressLabel } from "./format";
import { dayLabel, useDayIndex } from "./queries";
import { RangeTrend } from "./range-trend";

const average = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

export function VitalsTab({ data }: { data: WellnessResponse }) {
  const index = useDayIndex(data.days);
  const month = useMemo(() => lastDays(30).map((d) => ({ date: d, day: index.get(d) })), [index]);
  const spo2Of = useCallback((d: string) => index.get(d)?.spo2Avg ?? null, [index]);
  const stress = month.map((m) => m.day?.stressAvg).filter((v): v is number => v != null);
  const spo2 = month.map((m) => m.day?.spo2Avg).filter((v): v is number => v != null);
  const spo2Mins = month.map((m) => m.day?.spo2Min).filter((v): v is number => v != null);
  const lowSpo2 = spo2Mins.filter((v) => v < 90).length;

  if (!stress.length && !spo2.length) {
    return (
      <EmptyState>
        Nessun dato di stress o ossigeno negli ultimi 30 giorni. Nell&apos;app Mi Fitness, alla pagina del dispositivo,
        attiva il monitoraggio continuo dello stress e la SpO₂ durante il sonno: senza, l&apos;orologio misura solo a mano.
      </EmptyState>
    );
  }
  const stressAvg = average(stress);
  const stressWeek = average(month.slice(-7).map((m) => m.day?.stressAvg).filter((v): v is number => v != null));

  // Pochi giorni misurati: quasi sempre il monitoraggio continuo è spento
  const sparse = stress.length < 7 || spo2.length < 7;

  return (
    <div className="space-y-5">
      {sparse && (
        <p className="rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground">
          Dati misurati in pochi giorni (stress {stress.length}, SpO₂ {spo2.length} su 30). Per averli ogni giorno attiva in
          Mi Fitness il monitoraggio continuo dello stress e la SpO₂ durante il sonno.
        </p>
      )}
      {stressAvg != null && (
        <Section title="Stress" hint="Dalla variabilità del battito, scala 1-100">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Oggi" value={month.at(-1)?.day?.stressAvg ?? "—"} detail={month.at(-1)?.day?.stressAvg != null ? stressLabel(month.at(-1)!.day!.stressAvg!) : undefined} />
            <Stat label="Media 7 gg" value={stressWeek != null ? Math.round(stressWeek) : "—"} />
            <Stat label="Media 30 gg" value={Math.round(stressAvg)} detail={stressLabel(stressAvg)} />
          </div>
          <DayBars
            barClassName="bg-amber-500/60"
            highlightClassName="bg-amber-500"
            bars={month.map(({ date, day }) => ({
              key: date,
              label: dayLabel(date),
              value: day?.stressAvg ?? null,
              caption: day?.stressAvg != null ? `media ${day.stressAvg}, picco ${day.stressMax ?? "—"}` : "nessun dato",
              highlight: (day?.stressAvg ?? 0) >= 60,
            }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">Le barre piene segnano i giorni con stress medio sopra 60. Sonno corto e allenamenti duri lo alzano.</p>
        </Section>
      )}

      {spo2.length > 0 && (
        <Section title="Ossigeno nel sangue" hint="SpO₂ medio del giorno">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Media 30 gg" value={formatDecimal(average(spo2)!)} unit="%" />
            <Stat label="Minimo" value={spo2Mins.length ? Math.min(...spo2Mins) : "—"} unit={spo2Mins.length ? "%" : undefined} />
            <Stat label="Sotto 90%" value={lowSpo2} detail="giorni" />
          </div>
          <RangeTrend value={spo2Of} unit="%" tone="sky" digits={1} />
          <p className="mt-3 text-xs text-muted-foreground">
            Valori tra 95% e 100% sono normali. Cali notturni ripetuti sotto il 90% meritano un confronto con il medico.
          </p>
        </Section>
      )}
    </div>
  );
}
