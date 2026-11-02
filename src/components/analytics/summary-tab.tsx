"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { itemsInPeriod, periodLabel, periodWindow, type ActivityItem, type Period } from "@/lib/insights";
import { PeriodBest } from "./period-best";
import { PeriodConsistency } from "./period-consistency";
import { PeriodHero } from "./period-hero";
import { usePeriodSelection } from "./period-picker";
import { PeriodChart, type ChartMetric } from "./period-chart";
import { formatDecimal } from "./format";
import { ActivityLegend, EmptyState } from "./ui";
import { useActivity } from "./use-activity";

/** Allenamenti o ore, palestra / corsa / altro impilati */
const METRICS: ChartMetric[] = [
  {
    value: "sessions",
    label: "Allenamenti",
    parts: (b) => ({ primary: b.gym, secondary: b.runs, tertiary: b.other }),
    format: (v) => formatDecimal(v),
  },
  {
    value: "duration",
    label: "Ore",
    parts: (b) => ({ primary: b.gymDuration / 3600, secondary: b.runDuration / 3600, tertiary: b.otherDuration / 3600 }),
    format: (v) => `${formatDecimal(v)}h`,
  },
];

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

function HistoryLink({ href, count }: { href: string; count: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card px-4 py-3.5 active:bg-muted/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
        <History className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">Storico allenamenti</span>
      <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/**
 * Riepilogo: una gerarchia sola per ogni periodo. In alto i numeri chiave,
 * poi l'andamento, il meglio del periodo e la costanza. Il singolo
 * allenamento resta nello storico, a un tocco.
 */
export function SummaryTab() {
  const { data: items, isLoading } = useActivity();
  const now = useMemo(() => new Date(), []);
  const selection = usePeriodSelection(now);
  const { period, anchor } = selection;
  const inPeriod = useMemo<ActivityItem[]>(
    () => (items ? itemsInPeriod(items, periodWindow(period, anchor, now)) : []),
    [items, period, anchor, now]
  );

  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    );
  }
  if (!items.length) return <EmptyState>Ancora nessun allenamento.</EmptyState>;

  return (
    <div className="space-y-5">
      <PeriodHero items={items} now={now} selection={selection} />
      <PeriodChart
        items={items}
        now={now}
        selection={selection}
        metrics={METRICS}
        legend={<ActivityLegend className="mt-1" other={items.some((i) => i.kind === "cardio")} />}
      />
      <PeriodBest items={inPeriod} period={period} />
      <PeriodConsistency all={items} inPeriod={inPeriod} period={period} anchor={anchor} now={now} />
      <HistoryLink href={historyHref(period, anchor, now)} count={inPeriod.length} />
    </div>
  );
}
