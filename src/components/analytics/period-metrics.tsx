"use client";

import { addDays, addMonths, addWeeks, addYears, format, max as latest, min as earliest, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { periodSeries, periodWindow, type ActivityItem, type Bucket, type SeriesUnit, type Totals } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { KIND_STYLE } from "./activity-kind";
import { StackedBars } from "./bars";
import { DiffBadge, diffTone, type CompareContext } from "./compare";
import type { PeriodSelection } from "./period-bar";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Una metrica del periodo, definita una volta sola: dà il valore al suo
 * riquadro e, se ha `parts`, le barre al grafico quando la scegli.
 */
export interface PeriodMetric {
  key: string;
  label: string;
  value: (t: Totals) => number;
  display: (v: number) => { value: string; unit?: string };
  /** la differenza col periodo prima, già con l'unità: "3", "2h 10m", "12 km" */
  diff: (abs: number) => string;
  /** il ritmo: meno è meglio */
  lowerIsBetter?: boolean;
  /** barre impilate (palestra, corsa, altro); senza, il riquadro non apre il grafico */
  parts?: (t: Totals) => { primary: number; secondary?: number; tertiary?: number };
  /** testo sopra le barre, nella scala di `parts` */
  caption?: (v: number) => string;
  /** unità detta nella media: "media 75 km al mese" */
  unit?: string;
}

/* ─── Riquadri ─── */

/**
 * I numeri del periodo in riquadri: ognuno col suo confronto, quello scelto
 * in scuro guida il grafico sotto. Sopra, una riga sola dice con cosa si
 * confronta.
 */
export function MetricTiles({
  metrics,
  current,
  previous,
  ctx,
  selected,
  onSelect,
  extra,
}: {
  metrics: PeriodMetric[];
  current: Totals;
  previous: Totals | null;
  ctx: CompareContext | null;
  selected: string;
  onSelect: (key: string) => void;
  /** contenuto in fondo a un riquadro (es. l'obiettivo dei km) */
  extra?: (key: string, active: boolean) => React.ReactNode;
}) {
  const showDiffs = !!previous && !!ctx && !ctx.early;
  return (
    <div>
      {ctx && (
        <p className="mb-2 text-xs text-muted-foreground first-letter:uppercase">
          {ctx.early ? `${ctx.name} è appena iniziat${ctx.name === "La settimana" ? "a" : "o"}: confronto tra qualche giorno` : ctx.against}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => {
          const value = m.value(current);
          const before = previous ? m.value(previous) : 0;
          const tone = showDiffs ? diffTone(value, before, { lowerIsBetter: m.lowerIsBetter, settling: ctx?.settling }) : null;
          const { value: text, unit } = m.display(value);
          const active = m.key === selected;
          const body = (
            <>
              <span className={cn("block text-xs font-medium", active ? "text-background/70" : "text-muted-foreground")}>{m.label}</span>
              <span className="mt-1 block truncate font-display text-[2rem] font-bold leading-none tabular-nums">
                {text}
                {unit && <span className="ml-0.5 text-sm font-semibold opacity-60">{unit}</span>}
              </span>
              <span className="mt-1.5 block min-h-4 text-xs">
                {tone && <DiffBadge inverse={active} diff={value - before} format={m.diff} tone={tone} />}
              </span>
              {extra?.(m.key, active)}
            </>
          );
          const className = cn(
            "min-w-0 rounded-2xl p-3.5 text-left",
            // Con un numero dispari di riquadri il primo prende tutta la riga
            metrics.length % 2 === 1 && i === 0 && "col-span-2",
            active ? "bg-foreground text-background" : "bg-muted/60"
          );
          return m.parts ? (
            <button key={m.key} type="button" onClick={() => onSelect(m.key)} aria-pressed={active} className={cn(className, "transition-transform active:scale-[0.98]")}>
              {body}
            </button>
          ) : (
            <div key={m.key} className={className}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Grafico ─── */

const NEXT: Record<SeriesUnit, (d: Date) => Date> = {
  day: (d) => addDays(d, 1),
  week: (d) => addWeeks(d, 1),
  month: (d) => addMonths(d, 1),
  year: (d) => addYears(d, 1),
};

/** "media 75 km al mese" */
const EACH: Record<SeriesUnit, string> = { day: "al giorno", week: "a settimana", month: "al mese", year: "all'anno" };

/** Un livello più in giù: l'anno apre i mesi, il mese le settimane, la settimana i giorni */
const DRILL: Record<SeriesUnit, "year" | "month" | "week" | null> = { year: "year", month: "month", week: "week", day: null };

const sumParts = (p: ReturnType<NonNullable<PeriodMetric["parts"]>>) => p.primary + (p.secondary ?? 0) + (p.tertiary ?? 0);

/** Media sui periodi già conclusi: quello in corso non abbassa la media */
function averageOf(buckets: Bucket[], unit: SeriesUnit, value: (b: Bucket) => number, now: Date) {
  if (unit === "day") return null;
  const done = buckets.filter((b) => NEXT[unit](b.start) <= now);
  if (done.length < 2) return null;
  return done.reduce((s, b) => s + value(b), 0) / done.length;
}

/**
 * Le barre della metrica scelta dentro il periodo, con la media dei periodi
 * conclusi. Toccare una barra apre quel periodo nella barra in alto.
 */
export function TrendChart({
  items,
  now,
  selection,
  metric,
  empty,
}: {
  items: ActivityItem[];
  now: Date;
  selection: PeriodSelection;
  metric: PeriodMetric;
  /** cosa proporre quando il periodo è vuoto, es. "Allenati oggi" */
  empty?: { label: string; href: string };
}) {
  const { period, anchor } = selection;
  const parts = metric.parts!;
  const caption = metric.caption ?? ((v: number) => String(Math.round(v)));
  const { unit, buckets } = periodSeries(items, period, anchor, now);
  const span = periodWindow(period, anchor, now);
  const sum = (b: Bucket) => sumParts(parts(b));
  const total = buckets.reduce((s, b) => s + sum(b), 0);
  const average = averageOf(buckets, unit, sum, now);
  const drill = DRILL[unit];

  // Nel mese le settimane si leggono come giorni del mese: "2–8", "30–31"
  const label = (d: Date) => {
    if (unit === "day") return format(d, "EEEEE", { locale: it });
    if (unit === "week") {
      const from = latest([d, span.from!]);
      const to = earliest([addDays(d, 6), subDays(span.to!, 1)]);
      return `${format(from, "d")}–${format(to, "d")}`;
    }
    return unit === "month" ? format(d, "MMMMM", { locale: it }) : format(d, "yyyy");
  };

  const open = (key: string) => {
    const bucket = buckets.find((b) => b.start.toISOString() === key);
    if (bucket && drill) selection.select(drill, latest([bucket.start, span.from ?? bucket.start]));
  };

  // Le parti della metrica nel periodo: diventano la legenda, coi loro valori
  const legend = Object.entries(parts(totalsOf(buckets)))
    .map(([part, value]) => ({ kind: PART_KIND[part as keyof typeof PART_KIND], value: value ?? 0 }))
    .filter((p) => p.value > 0);

  return (
    <div className="mt-6">
      {!total ? (
        <EmptyState action={empty && span.isCurrent ? empty : undefined}>Niente in questo periodo</EmptyState>
      ) : (
        <StackedBars
          height={130}
          labelEvery={buckets.length > 12 ? 2 : 1}
          onSelect={drill ? open : undefined}
          average={average != null ? { value: average, label: `media ${caption(average)}${metric.unit ? ` ${metric.unit}` : ""} ${EACH[unit]}` } : null}
          data={buckets.map((b) => {
            const value = sum(b);
            return {
              key: b.start.toISOString(),
              label: label(b.start),
              ...parts(b),
              caption: value ? caption(value) : undefined,
              highlight: b.start <= now && now < NEXT[unit](b.start),
              future: b.start > now,
            };
          })}
        />
      )}
      {legend.length > 1 && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legend.map((p) => (
            <span key={p.kind} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", KIND_STYLE[p.kind].dot)} aria-hidden />
              {KIND_STYLE[p.kind].label}
              <span className="font-semibold tabular-nums text-foreground">{caption(p.value)}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** primary = palestra, secondary = corsa, tertiary = altro: gli stessi colori delle barre */
const PART_KIND = { primary: "gym", secondary: "run", tertiary: "cardio" } as const;

/** I totali del periodo dalle sue barre (le parti si sommano) */
function totalsOf(buckets: Bucket[]): Totals {
  const keys = Object.keys(buckets[0] ?? {}).filter((k) => k !== "start") as (keyof Totals)[];
  const out = Object.fromEntries(keys.map((k) => [k, buckets.reduce((s, b) => s + (b[k] as number), 0)]));
  return out as unknown as Totals;
}
