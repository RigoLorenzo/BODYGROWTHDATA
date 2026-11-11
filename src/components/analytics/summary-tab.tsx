"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, min, subDays } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import { itemsInPeriod, periodConsistency, periodLabel, periodTotals, periodWindow, type ActivityItem, type Period } from "@/lib/insights";
import { compareContext } from "./compare";
import { formatDecimal } from "./format";
import { Frequency, type Fact } from "./frequency";
import { PeriodBar, PeriodSwipe, firstActivity } from "./period-bar";
import { bestOfPeriod } from "./period-best";
import { KM, LIFTED, SESSIONS, TIME } from "./metrics";
import { MetricTiles, TrendChart } from "./period-metrics";
import { usePeriodSelection } from "./period-picker";
import { RecordList } from "./record-list";
import { Block, EmptyState } from "./ui";
import { useActivity } from "./use-activity";
import { WeekGoal } from "@/components/dashboard/week-goal";

/** Giorni passati del periodo (fino a oggi): "16 su 31" */
function elapsedDays(period: Period, anchor: Date, now: Date) {
  const span = periodWindow(period, anchor, now);
  if (!span.from || !span.to) return null;
  return differenceInCalendarDays(min([now, subDays(span.to, 1)]), span.from) + 1;
}

/** Lo storico completo, filtrato sul periodo che stai guardando */
function historyHref(period: Period, anchor: Date, now: Date) {
  if (period === "all") return "/history";
  const span = periodWindow(period, anchor, now);
  const params = new URLSearchParams({
    from: format(span.from!, "yyyy-MM-dd"),
    to: format(span.to!, "yyyy-MM-dd"),
    label: periodLabel(period, anchor),
  });
  return `/history?${params}`;
}

/**
 * Riepilogo: una barra del periodo in alto governa tutta la pagina. Sotto,
 * "quanto" (riquadri + grafico della metrica scelta), "quando" (costanza) e
 * il meglio del periodo. Il singolo allenamento sta nello storico.
 */
export function SummaryTab() {
  const { data: items, isLoading } = useActivity();
  const { data: overview } = useAnalyticsOverview();
  const now = useMemo(() => new Date(), []);
  const selection = usePeriodSelection(now);
  const { period, anchor } = selection;
  const [metricKey, setMetricKey] = useState(SESSIONS.key);

  const all = useMemo(() => items ?? [], [items]);
  const first = useMemo(() => firstActivity(all), [all]);
  const metrics = useMemo(
    () => [SESSIONS, TIME, ...(all.some((i) => i.kind === "gym") ? [LIFTED] : []), ...(all.some((i) => i.kind === "run") ? [KM] : [])],
    [all]
  );
  const inPeriod = useMemo<ActivityItem[]>(() => itemsInPeriod(all, periodWindow(period, anchor, now)), [all, period, anchor, now]);

  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (!items.length) return <EmptyState>Ancora nessun allenamento.</EmptyState>;

  const { current, previous } = periodTotals(items, period, now, anchor);
  const metric = metrics.find((m) => m.key === metricKey) ?? SESSIONS;
  const consistency = periodConsistency(items, period, anchor, now);
  const elapsed = elapsedDays(period, anchor, now);
  const streak = overview?.streak ?? 0;
  const facts: Fact[] = [
    { label: "Giorni attivi", value: current.activeDays, detail: elapsed ? `su ${elapsed}` : undefined },
    ...(period === "week" ? [] : [{ label: "A settimana", value: formatDecimal(consistency.avgPerWeek), detail: "allenamenti" }]),
    { label: "Di fila", value: streak, detail: `record ${overview?.longestStreak ?? 0}` },
  ];
  const best = bestOfPeriod(inPeriod, period);
  // Settimana in corso: prima di tutto l'avanzamento verso l'obiettivo
  const span = periodWindow(period, anchor, now);
  const currentWeek = period === "week" && !!span.from && !!span.to && now >= span.from && now < span.to;

  return (
    <div className="space-y-6">
      <PeriodBar selection={selection} now={now} first={first} pickerItems={items} />
      {currentWeek && <WeekGoal goal={overview?.goal} className="mt-0" />}

      <PeriodSwipe selection={selection} now={now} first={first}>
        <MetricTiles
          metrics={metrics}
          current={current}
          previous={period === "all" ? null : previous}
          ctx={compareContext(period, anchor, now)}
          selected={metric.key}
          onSelect={setMetricKey}
        />
        <TrendChart items={items} now={now} selection={selection} metric={metric} empty={{ label: "Allenati oggi", href: "/dashboard" }} />
      </PeriodSwipe>

      {best.length > 0 && (
        <Block
          title={period === "all" ? "Record" : "Migliori del periodo"}
          action={
            <Link href="/records" className="-mr-2 flex h-8 items-center gap-0.5 px-2 text-xs font-medium text-muted-foreground active:text-foreground">
              Per esercizio <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        >
          <RecordList items={best} />
        </Block>
      )}

      <Block title="Costanza">
        <Frequency items={items} period={period} anchor={anchor} now={now} facts={facts} />
      </Block>

      <Link
        href={historyHref(period, anchor, now)}
        className="flex h-12 items-center justify-between rounded-2xl bg-muted/60 px-4 text-sm font-medium active:bg-muted"
      >
        <span>
          Tutti gli allenamenti <span className="text-muted-foreground tabular-nums">· {inPeriod.length}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
