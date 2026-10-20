"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import {
  consistency,
  monthlySeries,
  periodTotals,
  timeOfDay,
  weekdayStats,
  weeklySeries,
  type ActivityItem,
  type Period,
} from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { cn, formatVolume } from "@/lib/utils";
import { HorizontalBars, StackedBars } from "./bars";
import { formatDecimal, formatDelta, formatHours } from "./format";
import { ActivityLegend, EmptyState, Section, Segmented, Stat } from "./ui";
import { HabitHighlights } from "./highlights";
import { useActivity } from "./use-activity";

const PERIODS = [
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
  { value: "year", label: "Anno" },
  { value: "all", label: "Sempre" },
] as const;

const PREVIOUS_LABEL: Record<Period, string> = {
  week: "settimana scorsa",
  month: "mese scorso",
  year: "anno scorso",
  all: "",
};


/** Il periodo scelto a colpo d'occhio, con il confronto allo stesso punto del periodo precedente */
function PeriodHero({ items, now }: { items: ActivityItem[]; now: Date }) {
  const [period, setPeriod] = useState<Period>("month");
  const { current, previous } = periodTotals(items, period, now);
  const delta = formatDelta(current.sessions, previous?.sessions);

  const cells = [
    { label: "Palestra", value: current.gym, unit: current.gym === 1 ? "seduta" : "sedute" },
    { label: "Corsa", value: current.runs, unit: current.runs === 1 ? "uscita" : "uscite" },
    { label: "Tempo", value: formatHours(current.duration) },
    { label: "Volume", value: formatVolume(current.volume) },
    { label: "Serie", value: current.sets.toLocaleString("it-IT") },
    { label: "Km", value: formatKm(current.distance) },
  ];

  return (
    <section className="rounded-3xl bg-foreground p-5 text-background">
      <Segmented
        value={period}
        options={PERIODS}
        onChange={setPeriod}
        size="sm"
        className="bg-background/15 [&_[aria-selected=false]]:text-background/70 [&_[aria-selected=true]]:bg-background [&_[aria-selected=true]]:text-foreground"
      />
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-6xl font-bold leading-none tabular-nums">{current.sessions}</p>
          <p className="mt-1 text-sm opacity-70">
            {current.sessions === 1 ? "allenamento" : "allenamenti"} · {current.activeDays}{" "}
            {current.activeDays === 1 ? "giorno attivo" : "giorni attivi"}
          </p>
        </div>
        {delta && previous && (
          <div className="text-right">
            <p className={cn("font-display text-2xl font-bold", delta.startsWith("−") ? "text-red-300" : "text-lime-400")}>{delta}</p>
            <p className="text-xs opacity-70">
              vs {PREVIOUS_LABEL[period]} ({previous.sessions})
            </p>
          </div>
        )}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-4 border-t border-background/15 pt-4">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider opacity-60">{c.label}</p>
            <p className="truncate font-display text-xl font-bold tabular-nums">
              {c.value}
              {c.unit && <span className="ml-1 text-xs font-medium opacity-60">{c.unit}</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Costanza: streak, record e settimane attive */
function Consistency({ items, now }: { items: ActivityItem[]; now: Date }) {
  const { data: overview } = useAnalyticsOverview();
  const c = consistency(items, 12, now);
  return (
    <Section title="Costanza" hint="Ultime 12 settimane">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Stat
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1">
              {overview?.streak ?? 0}
              <Flame className={cn("h-5 w-5", (overview?.streak ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground")} />
            </span>
          }
          unit="giorni"
          detail={`Record: ${overview?.longestStreak ?? 0} giorni`}
        />
        <Stat label="Media" value={formatDecimal(c.avgPerWeek)} unit="a settimana" detail="Palestra e corsa insieme" />
        <div className="col-span-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Settimane attive</p>
            <p className="text-sm font-semibold tabular-nums">
              {c.activeWeeks}/{c.weeks} · {c.percent}%
            </p>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-lime-500" style={{ width: `${c.percent}%` }} />
          </div>
        </div>
      </div>
    </Section>
  );
}

const WEEK_METRICS = [
  { value: "sessions", label: "Allenamenti" },
  { value: "duration", label: "Ore" },
] as const;

/** Ultime 12 settimane: palestra e corsa impilate */
function WeeklyActivity({ items, now }: { items: ActivityItem[]; now: Date }) {
  const [metric, setMetric] = useState<(typeof WEEK_METRICS)[number]["value"]>("sessions");
  const weeks = weeklySeries(items, 12, now);
  const data = weeks.map((w, i) => ({
    key: w.start.toISOString(),
    label: format(w.start, "d/M"),
    primary: metric === "sessions" ? w.gym : w.gymDuration,
    secondary: metric === "sessions" ? w.runs : w.duration - w.gymDuration,
    caption: metric === "sessions" ? String(w.sessions) : formatDecimal(w.duration / 3600),
    // La settimana in corso in evidenza
    highlight: i === weeks.length - 1,
  }));
  return (
    <Section title="Ultime 12 settimane" hint={<ActivityLegend className="mt-1" />}>
      <Segmented value={metric} options={WEEK_METRICS} onChange={setMetric} size="sm" className="mb-4" />
      <StackedBars data={data} labelEvery={3} />
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
    <Section title="Giorni della settimana" hint="Quando e quanto ti alleni">
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
    <Section title="Orari" hint="A che ora inizi ad allenarti">
      <HorizontalBars
        rows={slots.map((s) => ({
          key: s.key,
          label: `${s.label}`,
          value: s.sessions,
          caption: `${Math.round((s.sessions / Math.max(1, items.length)) * 100)}% · ${s.sessions}`,
          highlight: s.sessions > 0 && s.sessions === top,
        }))}
      />
    </Section>
  );
}

function Months({ items, now }: { items: ActivityItem[]; now: Date }) {
  const months = monthlySeries(items, 12, now);
  return (
    <Section title="Ultimi 12 mesi" hint={<ActivityLegend className="mt-1" />}>
      <StackedBars
        labelEvery={2}
        data={months.map((m, i) => ({
          key: m.start.toISOString(),
          label: format(m.start, "MMM", { locale: it }),
          primary: m.gym,
          secondary: m.runs,
          caption: String(m.sessions),
          highlight: i === months.length - 1,
        }))}
      />
    </Section>
  );
}

export function SummaryTab() {
  const { data: items, isLoading } = useActivity();
  const now = useMemo(() => new Date(), []);

  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }
  if (!items.length) {
    return <EmptyState>Ancora nessun allenamento: qui troverai costanza e le tue abitudini.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <PeriodHero items={items} now={now} />
      <Consistency items={items} now={now} />
      <HabitHighlights items={items} />
      <WeeklyActivity items={items} now={now} />
      <Weekdays items={items} />
      <TimeSlots items={items} />
      <Months items={items} now={now} />
    </div>
  );
}
