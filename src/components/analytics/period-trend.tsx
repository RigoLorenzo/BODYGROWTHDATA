"use client";

import { useState } from "react";
import { eachDayOfInterval, format, getDay, isToday, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { byDay, periodSeries, periodWindow, type ActivityItem, type Bucket, type SeriesUnit } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { StackedBars } from "./bars";
import { formatDecimal } from "./format";
import type { PeriodSelection } from "./period-hero";
import { ActivityLegend, Section, Segmented } from "./ui";

const METRICS = [
  { value: "sessions", label: "Allenamenti" },
  { value: "duration", label: "Ore" },
] as const;
type Metric = (typeof METRICS)[number]["value"];

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const LABEL: Record<SeriesUnit, (d: Date) => string> = {
  day: (d) => format(d, "EEEEE", { locale: it }),
  month: (d) => format(d, "MMMMM", { locale: it }),
  year: (d) => format(d, "yyyy"),
};

const TITLE: Record<SeriesUnit, string> = {
  day: "Giorno per giorno",
  month: "Mese per mese",
  year: "Anno per anno",
};

/** Il mese a colpo d'occhio: ogni giorno colorato per palestra, corsa o entrambe */
function MonthCalendar({ from, to, items }: { from: Date; to: Date; items: ActivityItem[] }) {
  const days = byDay(items);
  const list = eachDayOfInterval({ start: from, end: subDays(to, 1) });
  const pad = (getDay(from) + 6) % 7;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground" aria-hidden>
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: pad }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {list.map((day) => {
          const sessions = days.get(dayKey(day)) ?? [];
          const gym = sessions.some((s) => s.kind === "gym");
          // Corsa, bici e altro insieme: il colore della resistenza
          const run = sessions.some((s) => s.kind === "run");
          const other = !run && sessions.some((s) => s.kind === "cardio");
          return (
            <span
              key={dayKey(day)}
              title={`${format(day, "d MMMM", { locale: it })}: ${sessions.length || "nessun"} allenament${sessions.length === 1 ? "o" : "i"}`}
              className={cn(
                "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold tabular-nums",
                gym ? "bg-foreground text-background" : run ? "bg-lime-500 text-zinc-950" : other ? "bg-sky-500 text-white" : "bg-muted/60 text-muted-foreground",
                isToday(day) && "ring-2 ring-inset ring-lime-500"
              )}
            >
              {format(day, "d")}
              {gym && (run || other) && (
                <span className={cn("absolute bottom-0 left-0 h-1 w-full", run ? "bg-lime-500" : "bg-sky-500")} aria-hidden />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Dove toccare una barra porta: un anno apre i suoi mesi, un mese il suo calendario */
function drillTarget(unit: SeriesUnit) {
  if (unit === "month") return "month" as const;
  if (unit === "year") return "year" as const;
  return null;
}

function SeriesChart({ unit, buckets, selection }: { unit: SeriesUnit; buckets: Bucket[]; selection: PeriodSelection }) {
  const [metric, setMetric] = useState<Metric>("sessions");
  const now = new Date();
  const target = drillTarget(unit);
  const currentKey = (d: Date) =>
    unit === "day" ? dayKey(d) === dayKey(now) : unit === "month" ? format(d, "yyyy-MM") === format(now, "yyyy-MM") : d.getFullYear() === now.getFullYear();
  const open = (key: string) => {
    const bucket = buckets.find((b) => b.start.toISOString() === key);
    if (bucket && target && bucket.start <= now) selection.select(target, bucket.start);
  };

  return (
    <>
      <Segmented value={metric} options={METRICS} onChange={setMetric} size="sm" className="mb-4" />
      <StackedBars
        height={140}
        labelEvery={buckets.length > 12 ? 2 : 1}
        onSelect={target ? open : undefined}
        data={buckets.map((b) => ({
          key: b.start.toISOString(),
          label: LABEL[unit](b.start),
          primary: metric === "sessions" ? b.gym : b.gymDuration,
          secondary: metric === "sessions" ? b.runs : b.runDuration,
          tertiary: metric === "sessions" ? b.other : b.otherDuration,
          caption: metric === "sessions" ? (b.sessions ? String(b.sessions) : undefined) : b.duration ? formatDecimal(b.duration / 3600) : undefined,
          highlight: currentKey(b.start),
        }))}
      />
      {target && <p className="mt-3 text-center text-[11px] text-muted-foreground">Tocca una barra per aprire {target === "month" ? "il mese" : "l'anno"}</p>}
    </>
  );
}

/**
 * Un solo grafico che segue il periodo scelto: i giorni della settimana, il
 * calendario del mese, i mesi dell'anno, gli anni da sempre.
 */
export function PeriodTrend({ items, now, selection }: { items: ActivityItem[]; now: Date; selection: PeriodSelection }) {
  const { period, anchor } = selection;
  const hasOther = items.some((i) => i.kind === "cardio");

  if (period === "month") {
    const span = periodWindow(period, anchor, now);
    return (
      <Section title="Calendario" hint={<ActivityLegend className="mt-1" other={hasOther} />}>
        <MonthCalendar from={span.from!} to={span.to!} items={items} />
      </Section>
    );
  }

  const { unit, buckets } = periodSeries(items, period, anchor, now);
  return (
    <Section title={TITLE[unit]} hint={<ActivityLegend className="mt-1" other={hasOther} />}>
      <SeriesChart unit={unit} buckets={buckets} selection={selection} />
    </Section>
  );
}
