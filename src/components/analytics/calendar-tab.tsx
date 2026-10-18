"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Dumbbell, Footprints } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutHistoryList } from "@/components/calendar/workout-history-list";
import { byDay, totals, type ActivityItem } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { cn, formatVolume } from "@/lib/utils";
import { formatHours } from "./format";
import { ActivityLegend, Section } from "./ui";
import { activityHref, useActivity } from "./use-activity";

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/** Le sedute di un giorno, con link al dettaglio */
function DayDetail({ day, items }: { day: Date; items: ActivityItem[] }) {
  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      <p className="text-sm font-semibold capitalize">{format(day, "EEEE d MMMM", { locale: it })}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{isToday(day) ? "Ancora niente oggi." : "Giorno di riposo."}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={activityHref(i)} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 active:bg-muted">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    i.kind === "run" ? "bg-lime-500/15 text-lime-700 dark:text-lime-400" : "bg-foreground/10"
                  )}
                >
                  {i.kind === "run" ? <Footprints className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(i.startedAt, "HH:mm")} · {formatHours(i.duration)}
                  </p>
                </div>
                <p className="shrink-0 font-display text-lg font-bold tabular-nums">
                  {i.kind === "run" ? `${formatKm(i.distance)} km` : formatVolume(i.volume)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonthCalendar({ items }: { items: ActivityItem[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const days = useMemo(() => byDay(items), [items]);

  const monthDays = eachDayOfInterval({ start: month, end: endOfMonth(month) });
  const pad = (getDay(month) + 6) % 7;
  const monthItems = items.filter((i) => isSameMonth(i.startedAt, month));
  const t = totals(monthItems);

  const go = (delta: number) => {
    const next = addMonths(month, delta);
    setMonth(next);
    setSelected(isSameMonth(new Date(), next) ? new Date() : next);
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} aria-label="Mese precedente" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">{format(month, "MMMM yyyy", { locale: it })}</h2>
          <p className="text-xs text-muted-foreground">
            {t.gym} palestra · {t.runs} corse · {formatHours(t.duration)}
          </p>
        </div>
        <button onClick={() => go(1)} aria-label="Mese successivo" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: pad }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {monthDays.map((day) => {
          const list = days.get(dayKey(day)) ?? [];
          const gym = list.some((i) => i.kind === "gym");
          const run = list.some((i) => i.kind === "run");
          const isSelected = isSameDay(day, selected);
          return (
            <button
              key={dayKey(day)}
              onClick={() => setSelected(day)}
              aria-pressed={isSelected}
              aria-label={format(day, "d MMMM", { locale: it })}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm tabular-nums transition-colors",
                isSelected ? "bg-foreground text-background" : list.length ? "bg-muted font-semibold" : "text-muted-foreground",
                isToday(day) && !isSelected && "ring-2 ring-inset ring-foreground"
              )}
            >
              {format(day, "d")}
              <span className="flex h-1.5 gap-0.5">
                {gym && <span className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-background" : "bg-foreground")} />}
                {run && <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />}
              </span>
            </button>
          );
        })}
      </div>
      <ActivityLegend className="mt-3 justify-center" />
      <DayDetail day={selected} items={days.get(dayKey(selected)) ?? []} />
    </section>
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
            return (
              <span
                key={dayKey(day)}
                title={`${format(day, "d MMM", { locale: it })}${list.length ? ` · ${formatHours(seconds)}` : ""}`}
                className={cn(
                  "aspect-square rounded-[3px]",
                  day > today ? "bg-transparent" : !list.length ? "bg-muted" : onlyRun ? "bg-lime-500" : shade(seconds)
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
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-lime-500" /> Solo corsa
        </span>
      </div>
    </Section>
  );
}

export function CalendarTab() {
  const { data: items, isLoading } = useActivity();
  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-[28rem] rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <MonthCalendar items={items} />
      <Heatmap items={items} />
      <section>
        <h2 className="mb-2 px-1 font-display text-xl font-bold uppercase tracking-wide">Storico</h2>
        <WorkoutHistoryList />
      </section>
    </div>
  );
}
