"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isSameMonth, startOfWeek, subWeeks } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutHistoryList } from "@/components/calendar/workout-history-list";
import { byDay, monthlySeries, timeOfDay, weekdayStats, weeklySeries, type ActivityItem } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { HorizontalBars, StackedBars } from "./bars";
import { formatDecimal, formatHours } from "./format";
import { HabitHighlights } from "./highlights";
import { ActivityLegend, EmptyState, Section, Segmented } from "./ui";
import { useActivity } from "./use-activity";

/**
 * Andamento: come ti alleni nel tempo (mesi, settimane, giorni attivi),
 * le tue abitudini (giorni e orari) e l'elenco di tutti gli allenamenti.
 * Il dettaglio di un periodo sta nel Riepilogo.
 */

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/** Ultimi 12 mesi: tocca un mese per aprirlo nel Riepilogo */
function Months({ items, now }: { items: ActivityItem[]; now: Date }) {
  const router = useRouter();
  const months = monthlySeries(items, 12, now);
  const open = (key: string) => {
    const month = months.find((m) => m.start.toISOString() === key);
    if (month) router.push(`/analytics?del=${format(month.start, "yyyy-MM-dd")}`);
  };
  return (
    <Section title="Ultimi 12 mesi" hint={<ActivityLegend className="mt-1" other={months.some((m) => m.other > 0)} />}>
      <StackedBars
        labelEvery={2}
        onSelect={open}
        data={months.map((m, i) => ({
          key: m.start.toISOString(),
          label: format(m.start, "MMM", { locale: it }),
          primary: m.gym,
          secondary: m.runs,
          tertiary: m.other,
          caption: String(m.sessions),
          highlight: i === months.length - 1,
        }))}
      />
    </Section>
  );
}

const WEEK_METRICS = [
  { value: "sessions", label: "Allenamenti" },
  { value: "duration", label: "Ore" },
] as const;

/** Ultime 12 settimane: palestra, corsa e altro impilati */
function WeeklyActivity({ items, now }: { items: ActivityItem[]; now: Date }) {
  const [metric, setMetric] = useState<(typeof WEEK_METRICS)[number]["value"]>("sessions");
  const weeks = weeklySeries(items, 12, now);
  const data = weeks.map((w, i) => ({
    key: w.start.toISOString(),
    label: format(w.start, "d/M"),
    primary: metric === "sessions" ? w.gym : w.gymDuration,
    secondary: metric === "sessions" ? w.runs : w.runDuration,
    tertiary: metric === "sessions" ? w.other : w.otherDuration,
    caption: metric === "sessions" ? String(w.sessions) : formatDecimal(w.duration / 3600),
    // La settimana in corso in evidenza
    highlight: i === weeks.length - 1,
  }));
  return (
    <Section title="Ultime 12 settimane" hint={<ActivityLegend className="mt-1" other={weeks.some((w) => w.other > 0)} />}>
      <Segmented value={metric} options={WEEK_METRICS} onChange={setMetric} size="sm" className="mb-4" />
      <StackedBars data={data} labelEvery={3} />
    </Section>
  );
}

const HEATMAP_WEEKS = 26;

/** Ultimi 6 mesi: colonne = settimane, righe = giorni; più scuro = più tempo */
function Heatmap({ items }: { items: ActivityItem[] }) {
  const days = useMemo(() => byDay(items), [items]);
  const firstWeek = startOfWeek(subWeeks(new Date(), HEATMAP_WEEKS - 1), { weekStartsOn: 1 });
  const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => addDays(firstWeek, w * 7));
  const today = new Date();

  // Soglie di intensità dai tuoi stessi allenamenti (quartili della durata giornaliera)
  const durations = Array.from(days.values())
    .map((l) => l.reduce((s, i) => s + i.duration, 0))
    .sort((a, b) => a - b);
  const q = (p: number) => durations[Math.floor((durations.length - 1) * p)] ?? 0;
  const levels = [q(0.25), q(0.5), q(0.75)];
  const shade = (seconds: number) =>
    seconds <= levels[0] ? "bg-foreground/30" : seconds <= levels[1] ? "bg-foreground/50" : seconds <= levels[2] ? "bg-foreground/75" : "bg-foreground";

  const activeDays = weeks.flatMap((w) => Array.from({ length: 7 }, (_, d) => addDays(w, d))).filter((d) => days.has(dayKey(d))).length;

  return (
    <Section title="Ultimi 6 mesi" hint={`${activeDays} giorni attivi su ${HEATMAP_WEEKS} settimane`}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` }}>
        {weeks.map((w, i) => {
          const showMonth = i === 0 || !isSameMonth(w, weeks[i - 1]);
          return (
            <span key={`m-${i}`} className="h-4 overflow-visible whitespace-nowrap text-[10px] capitalize text-muted-foreground">
              {showMonth && i < HEATMAP_WEEKS - 1 ? format(w, "MMM", { locale: it }) : ""}
            </span>
          );
        })}
        {Array.from({ length: 7 }, (_, d) =>
          weeks.map((w) => {
            const day = addDays(w, d);
            const list = days.get(dayKey(day)) ?? [];
            const seconds = list.reduce((s, i) => s + i.duration, 0);
            const onlyRun = list.length > 0 && list.every((i) => i.kind === "run");
            const onlyOther = list.length > 0 && list.every((i) => i.kind === "cardio");
            return (
              <span
                key={dayKey(day)}
                title={`${format(day, "d MMM", { locale: it })}${list.length ? ` · ${formatHours(seconds)}` : ""}`}
                className={cn(
                  "aspect-square rounded-[3px]",
                  day > today
                    ? "bg-transparent"
                    : !list.length
                      ? "bg-muted"
                      : onlyRun
                        ? "bg-lime-500"
                        : onlyOther
                          ? "bg-sky-500"
                          : shade(seconds)
                )}
                style={{ gridRow: d + 2 }}
              />
            );
          })
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          Meno
          {["bg-muted", "bg-foreground/30", "bg-foreground/50", "bg-foreground/75", "bg-foreground"].map((c) => (
            <span key={c} className={cn("h-2.5 w-2.5 rounded-[3px]", c)} />
          ))}
          Più tempo
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-lime-500" /> Solo corsa
          </span>
          {items.some((i) => i.kind === "cardio") && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-sky-500" /> Bici e altro
            </span>
          )}
        </span>
      </div>
    </Section>
  );
}

const DAY_METRICS = [
  { value: "sessions", label: "Allenamenti" },
  { value: "avg", label: "Durata media" },
  { value: "total", label: "Ore totali" },
] as const;

function Weekdays({ items }: { items: ActivityItem[] }) {
  const [metric, setMetric] = useState<(typeof DAY_METRICS)[number]["value"]>("sessions");
  const days = weekdayStats(items);
  const value = (d: (typeof days)[number]) => (metric === "sessions" ? d.sessions : metric === "avg" ? d.avgDuration : d.duration);
  const top = Math.max(...days.map(value));
  return (
    <Section title="Giorni della settimana">
      <Segmented value={metric} options={DAY_METRICS} onChange={setMetric} size="sm" className="mb-4" />
      <HorizontalBars
        rows={days.map((d) => ({
          key: d.name,
          label: d.name,
          value: value(d),
          caption: metric === "sessions" ? `${d.sessions}` : formatHours(value(d)),
          highlight: value(d) > 0 && value(d) === top,
        }))}
      />
    </Section>
  );
}

function TimeSlots({ items }: { items: ActivityItem[] }) {
  const slots = timeOfDay(items);
  const top = Math.max(...slots.map((s) => s.sessions));
  return (
    <Section title="Orari">
      <HorizontalBars
        rows={slots.map((s) => ({
          key: s.key,
          label: `${s.label}`,
          value: s.sessions,
          caption: `${s.sessions}`,
          highlight: s.sessions > 0 && s.sessions === top,
        }))}
      />
    </Section>
  );
}

export function TrendsTab() {
  const { data: items, isLoading } = useActivity();
  const now = useMemo(() => new Date(), []);
  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  if (!items.length) return <EmptyState>Ancora nessun allenamento.</EmptyState>;
  return (
    <div className="space-y-5">
      <Months items={items} now={now} />
      <WeeklyActivity items={items} now={now} />
      <Heatmap items={items} />
      <HabitHighlights items={items} />
      <Weekdays items={items} />
      <TimeSlots items={items} />
      <section>
        <h2 className="mb-2 px-1 font-display text-xl font-bold uppercase tracking-wide">Tutti gli allenamenti</h2>
        <WorkoutHistoryList />
      </section>
    </div>
  );
}
