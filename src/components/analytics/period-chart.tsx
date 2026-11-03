"use client";

import { useState } from "react";
import { addDays, addMonths, addYears, eachDayOfInterval, format, getDay, isToday, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { byDay, periodSeries, periodWindow, type ActivityItem, type Bucket, type SeriesUnit } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { StackedBars } from "./bars";
import type { PeriodSelection } from "./period-card";
import { Section, Segmented } from "./ui";

/** Cosa misurano le barre: le parti impilate e il totale da scrivere sopra */
export interface ChartMetric {
  value: string;
  label: string;
  /** cosa misura il grafico, come titolo: "Allenamenti" → "Allenamenti per mese" */
  title: string;
  /** unità detta nella media ("75 km al mese"), se il formato non la scrive già */
  unit?: string;
  parts: (b: Bucket) => { primary: number; secondary?: number; tertiary?: number };
  /** testo sopra la barra e nella linea della media */
  format: (v: number) => string;
}

/** Come colorare un giorno del calendario del mese */
export type DayTone = (sessions: ActivityItem[]) => { className: string; mark?: string } | null;

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const LABEL: Record<SeriesUnit, (d: Date) => string> = {
  day: (d) => format(d, "EEEEE", { locale: it }),
  month: (d) => format(d, "MMMMM", { locale: it }),
  year: (d) => format(d, "yyyy"),
};

/** "Allenamenti per mese", "Km corsi per giorno" */
const PER: Record<SeriesUnit, string> = { day: "per giorno", month: "per mese", year: "per anno" };
/** "9 al mese": la media detta come si dice a voce */
const EACH: Record<SeriesUnit, string> = { day: "al giorno", month: "al mese", year: "all'anno" };

const NEXT: Record<SeriesUnit, (d: Date) => Date> = {
  day: (d) => addDays(d, 1),
  month: (d) => addMonths(d, 1),
  year: (d) => addYears(d, 1),
};

/** Palestra scura, corsa verde, altro azzurro; un segno in basso se nello stesso giorno c'è anche altro */
export const kindDayTone: DayTone = (sessions) => {
  const gym = sessions.some((s) => s.kind === "gym");
  const run = sessions.some((s) => s.kind === "run");
  const other = sessions.some((s) => s.kind === "cardio");
  if (gym) return { className: "bg-foreground text-background", mark: run ? "bg-lime-500" : other ? "bg-sky-500" : undefined };
  if (run) return { className: "bg-lime-500 text-zinc-950" };
  if (other) return { className: "bg-sky-500 text-white" };
  return null;
};

/** Il mese a colpo d'occhio: ogni giorno colorato in base a cosa hai fatto */
function MonthCalendar({ from, to, items, tone }: { from: Date; to: Date; items: ActivityItem[]; tone: DayTone }) {
  const days = byDay(items);
  const list = eachDayOfInterval({ start: from, end: subDays(to, 1) });
  const pad = (getDay(from) + 6) % 7;
  const today = new Date();
  const elapsed = list.filter((d) => d <= today).length;
  const active = list.filter((d) => days.has(dayKey(d))).length;
  return (
    <div>
      <p className="mb-3 text-sm">
        <span className="font-semibold tabular-nums">{active}</span>
        <span className="text-muted-foreground">
          {" "}
          {active === 1 ? "giorno attivo" : "giorni attivi"} su {elapsed}
          {elapsed < list.length ? " finora" : ""}
        </span>
      </p>
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
          const style = sessions.length ? tone(sessions) : null;
          return (
            <span
              key={dayKey(day)}
              title={`${format(day, "d MMMM", { locale: it })}: ${sessions.length || "nessun"} allenament${sessions.length === 1 ? "o" : "i"}`}
              className={cn(
                "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold tabular-nums",
                style?.className ?? "bg-muted/60 text-muted-foreground",
                isToday(day) && "ring-2 ring-inset ring-lime-500"
              )}
            >
              {format(day, "d")}
              {style?.mark && <span className={cn("absolute bottom-0 left-0 h-1 w-full", style.mark)} aria-hidden />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const sumParts = (p: ReturnType<ChartMetric["parts"]>) => p.primary + (p.secondary ?? 0) + (p.tertiary ?? 0);

/** Media sui periodi già conclusi (il mese in corso non abbassa la media) */
function averageOf(buckets: Bucket[], unit: SeriesUnit, value: (b: Bucket) => number, now: Date) {
  if (unit === "day") return null;
  const done = buckets.filter((b) => NEXT[unit](b.start) <= now);
  if (done.length < 2) return null;
  return done.reduce((s, b) => s + value(b), 0) / done.length;
}

function SeriesChart({
  unit,
  buckets,
  selection,
  metrics,
  metric,
  onMetric,
  now,
}: {
  unit: SeriesUnit;
  buckets: Bucket[];
  selection: PeriodSelection;
  metrics: ChartMetric[];
  metric: ChartMetric;
  onMetric: (value: string) => void;
  now: Date;
}) {
  // Un anno apre i suoi mesi, un mese il suo calendario; i giorni non si aprono
  const target = unit === "month" ? ("month" as const) : unit === "year" ? ("year" as const) : null;
  const sum = (b: Bucket) => sumParts(metric.parts(b));
  const isCurrent = (d: Date) => d <= now && now < NEXT[unit](d);
  const average = averageOf(buckets, unit, sum, now);

  const open = (key: string) => {
    const bucket = buckets.find((b) => b.start.toISOString() === key);
    if (bucket && target) selection.select(target, bucket.start);
  };

  return (
    <>
      {metrics.length > 1 && (
        <Segmented
          value={metric.value}
          options={metrics.map(({ value, label }) => ({ value, label }))}
          onChange={onMetric}
          size="sm"
          className="mb-4"
        />
      )}
      <StackedBars
        height={132}
        labelEvery={buckets.length > 12 ? 2 : 1}
        onSelect={target ? open : undefined}
        average={average != null ? { value: average, label: `La tua media: ${[metric.format(average), metric.unit, EACH[unit]].filter(Boolean).join(" ")}` } : null}
        data={buckets.map((b) => {
          const value = sum(b);
          return {
            key: b.start.toISOString(),
            label: LABEL[unit](b.start),
            ...metric.parts(b),
            caption: value ? metric.format(value) : undefined,
            highlight: isCurrent(b.start),
            future: b.start > now,
          };
        })}
      />
      {target && <p className="mt-3 text-center text-[11px] text-muted-foreground">Tocca una barra per aprire {target === "month" ? "il mese" : "l'anno"}</p>}
    </>
  );
}

/**
 * Un solo grafico che segue il periodo scelto nella card sopra: i giorni
 * della settimana, il calendario del mese, i mesi dell'anno, gli anni da
 * sempre. Toccare una barra apre quel periodo nella card.
 */
export function PeriodChart({
  items,
  now,
  selection,
  metrics,
  dayTone = kindDayTone,
  calendarTitle = "I giorni in cui ti sei allenato",
  legend,
}: {
  items: ActivityItem[];
  now: Date;
  selection: PeriodSelection;
  metrics: ChartMetric[];
  dayTone?: DayTone;
  calendarTitle?: string;
  legend?: React.ReactNode;
}) {
  const { period, anchor } = selection;
  // La metrica scelta resta tale anche passando dal calendario del mese ai mesi dell'anno
  const [metricKey, setMetricKey] = useState(metrics[0].value);
  const metric = metrics.find((m) => m.value === metricKey) ?? metrics[0];

  if (period === "month") {
    const span = periodWindow(period, anchor, now);
    return (
      <Section title={calendarTitle} hint={legend}>
        <MonthCalendar from={span.from!} to={span.to!} items={items} tone={dayTone} />
      </Section>
    );
  }

  const { unit, buckets } = periodSeries(items, period, anchor, now);
  const empty = buckets.every((b) => metrics.every((m) => sumParts(m.parts(b)) === 0));
  if (empty) {
    return (
      <Section title={`${metric.title} ${PER[unit]}`}>
        <p className="py-6 text-center text-sm text-muted-foreground">Ancora niente in questo periodo.</p>
      </Section>
    );
  }
  return (
    <Section title={`${metric.title} ${PER[unit]}`} hint={legend}>
      <SeriesChart
        unit={unit}
        buckets={buckets}
        selection={selection}
        metrics={metrics}
        metric={metric}
        onMetric={setMetricKey}
        now={now}
      />
    </Section>
  );
}
