"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/analytics/ui";
import { TREND_RANGES, trendPoints, type TrendRange } from "@/lib/wellness/insights";
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
}: {
  value: (date: string) => number | null;
  unit: string;
  tone?: React.ComponentProps<typeof TrendLine>["tone"];
  digits?: number;
  reference?: number | null;
  referenceLabel?: string;
}) {
  const [range, setRange] = useState<TrendRange>("3m");
  const days = TREND_RANGES.find((r) => r.value === range)!.days;
  const points = useMemo(() => trendPoints(days, value), [days, value]);
  const weekly = days > 90;

  return (
    <div className="space-y-3">
      <Segmented value={range} options={TREND_RANGES} onChange={setRange} size="sm" />
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
      />
      {weekly && <p className="text-[11px] text-muted-foreground">Media settimanale</p>}
    </div>
  );
}
