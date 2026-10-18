"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatKm, formatPace } from "@/lib/run/format";
import { cn } from "@/lib/utils";
import { FitnessCard } from "./fitness-card";
import { RecordsCard } from "./records-card";
import { RunList } from "./run-list";
import { RunSettings } from "./run-settings";
import { MiFitnessCard } from "./mifitness-card";
import { MiFitnessExpiredBanner } from "./run-header";
import { StravaCard } from "./strava-card";
import { WeeklyChart } from "./weekly-chart";
import { useRunStats, useRuns } from "./queries";
import type { PeriodTotals, RunStats } from "./types";

const PERIODS = [
  { key: "month", label: "Mese" },
  { key: "year", label: "Anno" },
  { key: "allTime", label: "Sempre" },
] as const;

/** Attività mostrate prima di "Mostra tutte": la pagina resta corta */
const RECENT_RUNS = 5;

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function TotalsGrid({ t }: { t: PeriodTotals }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      <Metric label="Corse" value={t.runs} />
      <Metric label="Distanza" value={formatKm(t.distance)} unit="km" />
      <Metric label="Tempo" value={formatDuration(t.movingTime)} />
      <Metric label="Ritmo medio" value={formatPace(t.avgPace)} unit="/km" />
      <Metric label="Dislivello" value={t.elevationGain} unit="m" />
      <Metric label="Media corsa" value={t.runs ? formatKm(t.distance / t.runs) : "–"} unit="km" />
    </div>
  );
}

/** Settimana in corso rispetto all'obiettivo */
function WeekHero({ stats }: { stats: RunStats }) {
  const { week, settings, runsPerWeek } = stats;
  const goal = settings.weeklyRunKmGoal ? settings.weeklyRunKmGoal * 1000 : null;
  const progress = goal ? Math.min(1, week.distance / goal) : null;
  const remaining = goal ? Math.max(0, goal - week.distance) : 0;

  return (
    <section className="rounded-3xl bg-foreground p-5 text-background">
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">Questa settimana</p>
      <p className="mt-1 font-display text-5xl font-bold tabular-nums leading-none">
        {formatKm(week.distance)}
        <span className="ml-1 text-lg font-semibold opacity-70">{goal ? `/ ${formatKm(goal)} km` : "km"}</span>
      </p>
      {progress != null && (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-background/20"
            role="progressbar"
            aria-label="Obiettivo settimanale"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="h-full rounded-full bg-lime-400 transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs tabular-nums opacity-80">
            {remaining > 0 ? `Mancano ${formatKm(remaining)} km all'obiettivo` : "Obiettivo raggiunto"}
          </p>
        </>
      )}
      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="opacity-80">Corse</p>
          <p className="font-display text-lg font-bold tabular-nums">{week.runs}</p>
        </div>
        <div>
          <p className="opacity-80">Ritmo</p>
          <p className="font-display text-lg font-bold tabular-nums">{formatPace(week.avgPace)}</p>
        </div>
        <div>
          <p className="opacity-80">Frequenza</p>
          <p className="font-display text-lg font-bold tabular-nums">
            {String(runsPerWeek).replace(".", ",")}
            <span className="text-xs font-medium opacity-70">/sett</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/** Statistiche della corsa: usate qui e nel tab Corsa di Analytics */
export function RunStatsSections({ stats }: { stats: RunStats }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("month");
  const tabsId = useId();
  return (
    <>
      <WeekHero stats={stats} />

      <section className="rounded-3xl border border-border/60 bg-card p-5" aria-labelledby={`${tabsId}-weekly`}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id={`${tabsId}-weekly`} className="font-display text-xl font-bold uppercase tracking-wide">
            Km a settimana
          </h2>
          <span className="text-xs text-muted-foreground">{stats.weekly.length} settimane</span>
        </div>
        <WeeklyChart weekly={stats.weekly} goalKm={stats.settings.weeklyRunKmGoal} />
      </section>

      <section className="rounded-3xl border border-border/60 bg-card p-5">
        <div className="mb-4 flex rounded-xl bg-muted p-1" role="tablist" aria-label="Periodo dei totali">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              id={`${tabsId}-${p.key}`}
              aria-controls={`${tabsId}-panel`}
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "h-9 flex-1 rounded-lg text-sm font-medium transition-colors",
                period === p.key ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${period}`}>
          <TotalsGrid t={stats[period]} />
        </div>
      </section>

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
      <MiFitnessExpiredBanner />
      {!hasRuns && (
        <p className="rounded-3xl border border-dashed border-border/60 p-5 text-sm text-muted-foreground">
          Nessuna corsa ancora. Collega Mi Fitness per importare quelle del tuo Xiaomi Watch, carica un file GPX o
          inseriscine una a mano. Ogni corsa conta come allenamento per la streak.
        </p>
      )}
      {!hasRuns && <MiFitnessCard />}
      {!hasRuns && <StravaCard />}

      {hasRuns && (
        <>
          <RunStatsSections stats={stats} />
          <RecentRuns />

          <MiFitnessCard />
          <StravaCard />
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
