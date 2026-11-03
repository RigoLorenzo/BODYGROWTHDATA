"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { periodLabel, periodTotals, periodWindow, type ActivityItem } from "@/lib/insights";
import { cn, formatVolume, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";
import { CompareLine, DiffBadge, compareContext } from "./compare";
import { formatDecimal, formatHours, splitUnit } from "./format";
import { HeadlineNumber, KpiRow, PeriodCard, firstActivity, type PeriodSelection } from "./period-card";
import { PeriodChart, type ChartMetric } from "./period-chart";
import { usePeriodSelection } from "./period-picker";
import { EmptyState, Section, Segmented } from "./ui";
import { useActivity } from "./use-activity";

/**
 * Palestra, con la stessa logica del Riepilogo: scegli il periodo nella card
 * in alto e grafico e muscoli lo seguono.
 */

const MUSCLES = ["CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES"];

interface MuscleStats {
  totalSets: number;
  tonnage: number;
  directSets: number;
  effectiveSets: number;
}

interface MuscleFreq {
  count: number;
  daysSince: number | null;
}

function useWeekly() {
  return useQuery<WeeklyAnalytics>({
    queryKey: ["analytics", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=weekly&weeks=8");
      if (!res.ok) throw new Error("Failed to fetch weekly analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Muscoli nel periodo [from, to); senza limiti ("sempre") gli ultimi 10 anni */
function useMuscleStats(from: Date | null, to: Date | null) {
  const fromIso = from?.toISOString() ?? null;
  const toIso = to?.toISOString() ?? null;
  return useQuery<Record<string, MuscleStats>>({
    queryKey: ["analytics", "muscle-stats", fromIso, toIso],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "muscle-stats" });
      if (fromIso) params.set("from", fromIso);
      else params.set("weeks", "520");
      if (toIso) params.set("to", toIso);
      const res = await fetch(`/api/analytics?${params}`);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
}

function useMuscleFrequency() {
  return useQuery<Record<string, MuscleFreq>>({
    queryKey: ["analytics", "muscle-frequency"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=muscle-frequency&days=14");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ─── Periodo ─── */

function StrengthHero({ items, now, selection }: { items: ActivityItem[]; now: Date; selection: PeriodSelection }) {
  const { period, anchor } = selection;
  const { current, previous } = periodTotals(items, period, now, anchor);
  const first = useMemo(() => firstActivity(items), [items]);
  const ctx = compareContext(period, anchor, now);
  const [lifted, liftedUnit] = splitUnit(formatVolume(current.volume));
  const hide = !previous || !ctx || ctx.early;
  const diff = (value: number, before: number | undefined, write: (n: number) => string) =>
    hide || !before ? undefined : <DiffBadge inverse diff={value - before} format={write} />;

  return (
    <PeriodCard selection={selection} now={now} first={first} pickerItems={items}>
      <HeadlineNumber
        value={current.gym}
        caption={current.gym === 1 ? "allenamento in palestra" : "allenamenti in palestra"}
        compare={
          previous && <CompareLine inverse ctx={ctx} diff={current.gym - previous.gym} previous={previous.gym} noun={(n) => (n === 1 ? "allenamento" : "allenamenti")} />
        }
      />
      <KpiRow
        items={[
          { label: "Peso sollevato", value: lifted, unit: liftedUnit, detail: diff(current.volume, previous?.volume, formatVolume) },
          { label: "Serie", value: current.sets.toLocaleString("it-IT"), detail: diff(current.sets, previous?.sets, String) },
          { label: "Tempo", value: formatHours(current.gymDuration), detail: diff(current.gymDuration, previous?.gymDuration, formatHours) },
        ]}
      />
      {current.gym > 0 && (
        <p className="mt-3 text-xs opacity-70">
          Ogni allenamento in media: <span className="font-semibold tabular-nums">{Math.round(current.sets / current.gym)} serie</span> e{" "}
          <span className="font-semibold tabular-nums">{formatVolume(current.volume / current.gym)}</span> sollevati
        </p>
      )}
    </PeriodCard>
  );
}

/** Sopra le barre serve poco spazio: 85,9t → "86t", 6,2t resta "6,2t" */
const compactVolume = (kg: number) => (kg >= 10_000 ? `${Math.round(kg / 1000)}t` : formatVolume(kg).replace(" kg", "kg"));

/** Volume o sedute, in nero come la palestra in tutta l'app */
const METRICS: ChartMetric[] = [
  { value: "volume", label: "Peso sollevato", title: "Peso sollevato", parts: (b) => ({ primary: b.volume }), format: compactVolume },
  { value: "sessions", label: "Allenamenti", title: "Allenamenti", unit: "allenamenti", parts: (b) => ({ primary: b.gym }), format: (v) => formatDecimal(v) },
];

/* ─── Muscoli ─── */

const MUSCLE_METRICS = [
  { value: "effective", label: "Serie" },
  { value: "tonnage", label: "Peso sollevato" },
] as const;
type MuscleMetric = (typeof MUSCLE_METRICS)[number]["value"];

const METRIC_HINT: Record<MuscleMetric, string> = {
  effective: "Le serie contano di più se il muscolo è il protagonista dell'esercizio e se arrivi vicino al cedimento.",
  tonnage: "Peso × ripetizioni degli esercizi in cui il muscolo è il principale.",
};

function muscleValue(stats: MuscleStats | undefined, metric: MuscleMetric) {
  if (!stats) return 0;
  if (metric === "effective") return stats.effectiveSets ?? 0;
  return stats.tonnage;
}

const formatMuscleValue = (v: number, metric: MuscleMetric) => (metric === "tonnage" ? formatVolume(v) : formatDecimal(v));

/** Da quanto non alleni il muscolo: verde se di recente, rosso se da più di 5 giorni */
function Recency({ freq }: { freq?: MuscleFreq }) {
  const days = freq?.count ? freq.daysSince : null;
  const text = days == null ? "—" : days === 0 ? "oggi" : days === 1 ? "ieri" : `${days}g fa`;
  const tone =
    days == null
      ? "text-muted-foreground"
      : days <= 2
        ? "text-lime-700 dark:text-lime-400"
        : days <= 5
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";
  return <span className={cn("w-12 shrink-0 text-right text-[11px] font-medium tabular-nums", tone)}>{text}</span>;
}

/** Le 8 settimane del muscolo aperto: serie efficaci per settimana */
function MuscleWeeks({ muscle, weekly }: { muscle: string; weekly?: WeeklyAnalytics }) {
  if (!weekly?.weeks.length) return null;
  const color = getMuscleColor(muscle);
  const values = weekly.weeks.map((w) => w.effectiveSetsByMuscle?.[muscle] ?? 0);
  const max = Math.max(1, ...values);
  return (
    <div className="pb-3 pl-4 pt-1">
      <div className="flex h-14 items-end gap-1.5">
        {values.map((v, i) => (
          <div key={weekly.weeks[i].weekStart} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-0.5 text-[9px] tabular-nums text-muted-foreground">{v ? formatDecimal(v) : ""}</span>
            <div
              className="w-full rounded-t"
              style={{ height: v ? `${(v / max) * 100}%` : 3, background: v ? color : "hsl(var(--muted))", opacity: i === values.length - 1 ? 1 : 0.6 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[9px] text-muted-foreground">
        {weekly.weeks.map((w, i) => (
          <span key={w.weekStart} className="flex-1 text-center">
            {i % 2 === 1 ? w.label : ""}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Serie efficaci a settimana, ultime 8 settimane</p>
    </div>
  );
}

function MuscleSection({ from, to, hint, weekly }: { from: Date | null; to: Date | null; hint: string; weekly?: WeeklyAnalytics }) {
  const [metric, setMetric] = useState<MuscleMetric>("effective");
  const [open, setOpen] = useState<string | null>(null);
  const { data: stats, isLoading } = useMuscleStats(from, to);
  const { data: freq } = useMuscleFrequency();

  const rows = MUSCLES.map((m) => ({ muscle: m, value: muscleValue(stats?.[m], metric) })).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const worked = rows.filter((r) => r.value > 0);
  const least = rows.at(-1)!;

  return (
    <Section title="Quanto alleni ogni muscolo" hint={hint}>
      <Segmented value={metric} options={MUSCLE_METRICS} onChange={setMetric} size="sm" />
      <p className="mb-4 mt-2 text-[11px] text-muted-foreground">{METRIC_HINT[metric]}</p>

      {isLoading && !stats ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !worked.length ? (
        <EmptyState>Nessuna serie in questo periodo.</EmptyState>
      ) : (
        <>
          {/* La lettura in una riga: dove lavori di più e cosa resta indietro */}
          <p className="mb-4 rounded-2xl bg-muted/60 px-3 py-2.5 text-sm">
            Alleni di più <span className="font-semibold">{getMuscleLabel(rows[0].muscle)}</span>
            {least.value < max * 0.35 ? (
              <>
                ; <span className="font-semibold">{getMuscleLabel(least.muscle)}</span> resta indietro.
              </>
            ) : (
              "; gli altri muscoli sono abbastanza bilanciati."
            )}
          </p>
          <div className="flex items-center gap-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground" aria-hidden>
            <span className="flex-1" />
            <span className="w-12 text-right">{metric === "tonnage" ? "Peso" : "Serie"}</span>
            <span className="w-12 text-right">Ultima volta</span>
            <span className="w-3.5" />
          </div>
          <ul>
            {rows.map(({ muscle, value }) => {
              const expanded = open === muscle;
              return (
                <li key={muscle} className="border-b border-border/40 last:border-0">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : muscle)}
                    aria-expanded={expanded}
                    className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left active:bg-muted/40"
                  >
                    <span className="w-20 shrink-0 truncate text-xs font-medium">{getMuscleLabel(muscle)}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: getMuscleColor(muscle) }} />
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
                      {value > 0 ? formatMuscleValue(value, metric) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <Recency freq={freq?.[muscle]} />
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />
                  </button>
                  {expanded && <MuscleWeeks muscle={muscle} weekly={weekly} />}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}

export function StrengthTab() {
  const { data: items, isLoading } = useActivity();
  const { data: weekly } = useWeekly();
  const now = useMemo(() => new Date(), []);
  const selection = usePeriodSelection(now);
  const gym = useMemo(() => (items ?? []).filter((i) => i.kind === "gym"), [items]);

  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  if (!gym.length) return <EmptyState>Ancora nessun allenamento in palestra.</EmptyState>;

  const span = periodWindow(selection.period, selection.anchor, now);
  return (
    <div className="space-y-5">
      <StrengthHero items={gym} now={now} selection={selection} />
      <PeriodChart items={gym} now={now} selection={selection} metrics={METRICS} />
      <MuscleSection from={span.from} to={span.to} hint={periodLabel(selection.period, selection.anchor)} weekly={weekly} />
      <Link href="/records" className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card px-4 py-3.5 active:bg-muted/50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Trophy className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">Record per esercizio</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </div>
  );
}
