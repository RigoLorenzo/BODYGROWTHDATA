"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/analytics/ui";
import { TREND_RANGES, lastDays, trendPoints, type TrendRange } from "@/lib/wellness/insights";
import { TrendLine } from "./charts";
import { dayLabel } from "./queries";

/** Andamento con scelta del periodo: giornaliero fino a 3 mesi, settimanale oltre */
export function RangeTrend({
  value,
  unit,
  tone,
  digits = 0,
  reference,
  referenceLabel,
  format,
}: {
  value: (date: string) => number | null;
  unit: string;
  tone?: React.ComponentProps<typeof TrendLine>["tone"];
  digits?: number;
  reference?: number | null;
  referenceLabel?: string;
  format?: (v: number) => string;
}) {
  const [range, setRange] = useState<TrendRange>("3m");
  const selected = TREND_RANGES.find((r) => r.value === range)!;
  const days = selected.days;
  const points = useMemo(() => trendPoints(days, value), [days, value]);
  // Media sui giorni con dati del periodo (non sulle medie settimanali)
  const average = useMemo(() => {
    const values = lastDays(days)
      .map(value)
      .filter((v): v is number => v != null);
    return values.length ? { value: values.reduce((s, v) => s + v, 0) / values.length, days: values.length } : null;
  }, [days, value]);
  const weekly = days > 90;
  const fmt = format ?? ((v: number) => `${v.toFixed(digits).replace(".", ",")} ${unit}`);

  return (
    <div className="space-y-3">
      <Segmented value={range} options={TREND_RANGES} onChange={setRange} size="sm" />
      {average && (
        <p className="text-sm">
          <span className="text-muted-foreground">Media {selected.label}: </span>
          <span className="font-semibold tabular-nums">{fmt(average.value)}</span>
          <span className="text-xs text-muted-foreground"> · {average.days} giorni con dati</span>
        </p>
      )}
      <TrendLine
        points={points.map((p) => ({
          key: p.date,
          label: weekly ? `sett. ${dayLabel(p.date)}` : dayLabel(p.date),
          value: p.value,
        }))}
        unit={unit}
        tone={tone}
        digits={digits}
        reference={reference}
        referenceLabel={referenceLabel}
        format={format}
      />
      {weekly && <p className="text-[11px] text-muted-foreground">Media settimanale</p>}
    </div>
  );
}
