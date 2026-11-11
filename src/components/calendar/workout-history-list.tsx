"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { KIND_STYLE } from "@/components/analytics/activity-kind";
import { cn, formatVolume, formatWorkoutDuration, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import { ChevronRight, Star } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";
import { formatKm, formatPace, paceSecondsPerKm } from "@/lib/run/format";
import { EmptyState } from "@/components/ui/empty-state";

/** Bici, camminate… importate dall'orologio: distanza e tempo invece di volume e serie */
const isImportedCardio = (w: WorkoutItem) => w.workoutType === "CARDIO" && !!w.sportType && !w.run;
const formatMinutes = (seconds?: number | null) => (seconds ? `${Math.round(seconds / 60)} min` : "—");

const workoutTitle = (w: WorkoutItem) =>
  w.run?.name ??
  w.title ??
  w.programDayName ??
  (w.workoutType === "CUSTOM" ? w.exercises?.[0]?.exercise?.name ?? "Allenamento" : w.workoutType);

const MUSCLE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tutti" },
  { value: "CHEST", label: "Petto" },
  { value: "BACK", label: "Dorso" },
  { value: "SHOULDERS", label: "Spalle" },
  { value: "BICEPS", label: "Bicipiti" },
  { value: "TRICEPS", label: "Tricipiti" },
  { value: "QUADS", label: "Quadricipiti" },
  { value: "HAMSTRINGS", label: "Femorali" },
  { value: "GLUTES", label: "Glutei" },
  { value: "CORE", label: "Core" },
  { value: "CALVES", label: "Polpacci" },
];

interface WorkoutExercise {
  id: string;
  exercise?: { name: string; primaryMuscle?: string | null };
}

interface WorkoutItem {
  id: string;
  workoutType: string;
  startedAt: string;
  endedAt?: string | null;
  totalVolume: number;
  totalSets: number;
  /** attività importate dall'orologio (bici, palestra…) */
  title?: string | null;
  sportType?: string | null;
  distance?: number | null;
  duration?: number | null;
  programDayId?: string | null;
  programDayName?: string | null;
  notes?: string | null;
  run?: { id: string; name: string; distance: number; movingTime: number } | null;
  exercises?: WorkoutExercise[];
  _count?: { personalRecords: number };
}

function groupByMonth(items: WorkoutItem[]) {
  const groups: { label: string; items: WorkoutItem[] }[] = [];
  let current: { label: string; items: WorkoutItem[] } | null = null;

  for (const item of items) {
    const label = format(new Date(item.startedAt), "MMMM yyyy", { locale: it });
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    if (!current || current.label !== capitalized) {
      current = { label: capitalized, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

/** Palestra, corsa o altro: lo stesso colore usato nel resto delle statistiche */
const kindOf = (w: WorkoutItem) => (w.run ? "run" : isImportedCardio(w) ? "cardio" : "gym") as keyof typeof KIND_STYLE;

/** Il dato principale a destra e una riga di contesto sotto il titolo */
function summary(w: WorkoutItem) {
  if (w.run) {
    return { value: `${formatKm(w.run.distance)} km`, meta: `${formatPace(paceSecondsPerKm(w.run.distance, w.run.movingTime))}/km` };
  }
  if (isImportedCardio(w)) {
    return { value: w.distance ? `${formatKm(w.distance)} km` : formatMinutes(w.duration), meta: w.distance ? formatMinutes(w.duration) : "Attività" };
  }
  const duration = w.endedAt ? formatWorkoutDuration(new Date(w.startedAt), new Date(w.endedAt)) : null;
  return {
    value: formatVolume(w.totalVolume),
    meta: [`${w.exercises?.length ?? 0} esercizi`, `${w.totalSets} serie`, duration].filter(Boolean).join(" · "),
  };
}

function HistoryRow({ workout }: { workout: WorkoutItem }) {
  const date = new Date(workout.startedAt);
  const kind = kindOf(workout);
  const Icon = KIND_STYLE[kind].icon;
  const { value, meta } = summary(workout);
  const prs = workout._count?.personalRecords ?? 0;
  return (
    <li>
      <Link
        href={workout.run ? `/run/${workout.run.id}` : `/workout/${workout.id}`}
        className="flex items-center gap-3 px-4 py-3 active:bg-muted/50"
      >
        <span className={cn("flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none", KIND_STYLE[kind].tile)}>
          <span className="font-display text-lg font-bold tabular-nums">{format(date, "d")}</span>
          <span className="text-[11px] font-semibold uppercase">{format(date, "EEE", { locale: it })}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{workoutTitle(workout)}</span>
            {prs > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
                {prs} PR
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        </span>
        <span className="shrink-0 font-display text-lg font-bold tabular-nums">{value}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * Lo storico completo, a pagine, raggruppato per mese. `range` limita
 * l'elenco a un periodo (es. il mese aperto nel Riepilogo).
 */
export function WorkoutHistoryList({ range }: { range?: { from: Date; to: Date } }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activeMuscle, setActiveMuscle] = useState("");
  const fromIso = range?.from.toISOString();
  const toIso = range?.to.toISOString();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<WorkoutItem[]>({
    queryKey: ["sessions", "history", activeMuscle, fromIso ?? null, toIso ?? null],
    queryFn: async ({ pageParam }) => {
      const offset = (pageParam as number) ?? 0;
      const params = new URLSearchParams({ limit: "20", offset: String(offset) });
      if (activeMuscle) params.set("muscle", activeMuscle);
      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);
      const res = await fetch(`/api/sessions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length === 20 ? allPages.length * 20 : undefined),
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allWorkouts = data?.pages.flat() ?? [];

  return (
    <div className="space-y-4">
      {/* Filtro per muscolo: solo le sedute che lo allenano come principale */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Filtra per muscolo">
        {MUSCLE_FILTERS.map((f) => {
          const isActive = activeMuscle === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setActiveMuscle(f.value)}
              aria-pressed={isActive}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors",
                isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground active:bg-muted/70"
              )}
            >
              {f.value && <span className="h-2 w-2 rounded-full" style={{ background: getMuscleColor(f.value) }} aria-hidden />}
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !allWorkouts.length ? (
        <EmptyState>
          {activeMuscle ? `Nessun allenamento per ${getMuscleLabel(activeMuscle)}.` : "Nessun allenamento in questo periodo."}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {groupByMonth(allWorkouts).map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
                <span className="font-medium tabular-nums">{group.items.length}</span>
              </h2>
              <ul className="divide-y divide-border/50 overflow-hidden rounded-3xl border border-border/60 bg-card">
                {group.items.map((workout) => (
                  <HistoryRow key={workout.id} workout={workout} />
                ))}
              </ul>
            </section>
          ))}

          <div ref={sentinelRef} className="py-2">
            {isFetchingNextPage && <Skeleton className="h-16 rounded-2xl" />}
            {!hasNextPage && <p className="py-4 text-center text-xs text-muted-foreground">Hai visto tutto</p>}
          </div>
        </div>
      )}
    </div>
  );
}
