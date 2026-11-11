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
import { RunProgress, useRunHistory } from "./run-period";
import { Block } from "@/components/analytics/ui";
import { usePeriodSelection } from "@/components/analytics/period-picker";
import type { RunStats } from "./types";

/** Attività mostrate prima di "Mostra tutte": la pagina resta corta */
const RECENT_RUNS = 5;

/**
 * La corsa per periodo (stessa struttura del Riepilogo), poi i record di
 * sempre e le attività.
 */
function RunStatsSections({ stats }: { stats: RunStats }) {
  const now = useMemo(() => new Date(), []);
  const runs = useRunHistory(stats);
  const selection = usePeriodSelection(now);
  return (
    <>
      <RunProgress stats={stats} runs={runs} now={now} selection={selection} />
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
    <Block title="Attività">
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
    </Block>
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
    <div className="space-y-6">
      <DeviceExpiredBanner />
      {!hasRuns && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
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
