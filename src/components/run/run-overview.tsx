"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RecordsCard } from "./records-card";
import { RunList } from "./run-list";
import { RunSettings } from "./run-settings";
import { DeviceExpiredBanner } from "./run-header";
import { useRunStats, useRuns } from "./queries";
import { DEVICES_PATH } from "@/components/devices/routes";
import { RunPeriodChart, RunPeriodHero, useRunHistory, useRunItems } from "./run-period";
import { usePeriodSelection } from "@/components/analytics/period-picker";
import type { RunStats } from "./types";

/** Attività mostrate prima di "Mostra tutte": la pagina resta corta */
const RECENT_RUNS = 5;

/**
 * Statistiche della corsa: la card del periodo e il grafico condividono la
 * stessa selezione, come in Analytics. Poi record e attività.
 */
function RunStatsSections({ stats }: { stats: RunStats }) {
  const now = useMemo(() => new Date(), []);
  const runs = useRunHistory(stats);
  const items = useRunItems(runs);
  const selection = usePeriodSelection(now, "week");
  return (
    <>
      <RunPeriodHero stats={stats} runs={runs} items={items} now={now} selection={selection} />
      <RunPeriodChart items={items} now={now} selection={selection} />
      <RecordsCard stats={stats} />
    </>
  );
}

/** Ultime attività, con tutte le altre a richiesta */
function RecentRuns() {
  const { data: runs } = useRuns();
  const [showAll, setShowAll] = useState(false);
  if (!runs) return <Skeleton className="h-48 rounded-3xl" />;

  const visible = showAll ? runs : runs.slice(0, RECENT_RUNS);
  return (
    <section aria-labelledby="run-activities">
      <h2 id="run-activities" className="mb-2 px-1 font-display text-xl font-bold uppercase tracking-wide">
        Attività
      </h2>
      <RunList runs={visible} />
      {runs.length > RECENT_RUNS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted/50"
        >
          {showAll ? "Mostra meno" : `Mostra tutte (${runs.length})`}
          <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} aria-hidden />
        </button>
      )}
    </section>
  );
}

export function RunOverview() {
  const { data: stats, isLoading } = useRunStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const hasRuns = stats.allTime.runs > 0;

  return (
    <div className="space-y-5">
      <DeviceExpiredBanner />
      {!hasRuns && (
        <p className="rounded-3xl border border-dashed border-border/60 p-5 text-center text-sm text-muted-foreground">
          Nessuna corsa ancora.{" "}
          <Link href={DEVICES_PATH} className="font-medium text-foreground underline underline-offset-2">
            Collega uno smartwatch
          </Link>{" "}
          o aggiungine una con il pulsante +.
        </p>
      )}
      {hasRuns && (
        <>
          <RunStatsSections stats={stats} />
          <RecentRuns />
        </>
      )}

      <RunSettings settings={stats.settings} />
    </div>
  );
}
