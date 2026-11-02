"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FitnessCard } from "./fitness-card";
import { RecordsCard } from "./records-card";
import { RunList } from "./run-list";
import { RunSettings } from "./run-settings";
import { DeviceExpiredBanner } from "./run-header";
import { WeeklyChart } from "./weekly-chart";
import { useRunStats, useRuns } from "./queries";
import { Section } from "@/components/analytics/ui";
import { DEVICES_PATH } from "@/components/devices/routes";
import { MonthlyKm, RunPeriodHero, useRunHistory } from "./run-period";
import type { RunStats } from "./types";

/** Attività mostrate prima di "Mostra tutte": la pagina resta corta */
const RECENT_RUNS = 5;

/** Statistiche della corsa: usate qui e nel tab Corsa di Analytics */
export function RunStatsSections({ stats }: { stats: RunStats }) {
  const now = useMemo(() => new Date(), []);
  const runs = useRunHistory(stats);
  return (
    <>
      <RunPeriodHero stats={stats} runs={runs} now={now} />
      <MonthlyKm runs={runs} now={now} />
      <Section title="Km a settimana">
        <WeeklyChart weekly={stats.weekly} goalKm={stats.settings.weeklyRunKmGoal} />
      </Section>
      <FitnessCard fitness={stats.fitness} />
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
          o aggiungine una qui sotto.
        </p>
      )}
      {hasRuns && (
        <>
          <RunStatsSections stats={stats} />
          <RecentRuns />
        </>
      )}

      <RunSettings settings={stats.settings} />

      <Link
        href="/run/new"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-medium text-muted-foreground active:bg-muted/50"
      >
        <Plus className="h-4 w-4" /> Aggiungi corsa (manuale o GPX)
      </Link>
    </div>
  );
}
