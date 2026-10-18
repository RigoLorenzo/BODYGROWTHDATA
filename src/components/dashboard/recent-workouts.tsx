"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronRight, Star } from "lucide-react";
import { formatVolume } from "@/lib/utils";
import { formatKm, formatPace, paceSecondsPerKm } from "@/lib/run/format";

interface WorkoutListItem {
  id: string;
  workoutType: string;
  startedAt: string | Date;
  totalVolume: number;
  totalSets: number;
  programDayName?: string | null;
  exercises?: { id: string; exercise?: { name: string } }[];
  run?: { id: string; name: string; distance: number; movingTime: number } | null;
  _count?: { personalRecords: number };
}

interface Props {
  initialData?: WorkoutListItem[];
}

const workoutTitle = (w: WorkoutListItem) =>
  w.run?.name ??
  w.programDayName ??
  (w.workoutType === "CUSTOM" ? w.exercises?.[0]?.exercise?.name ?? "Allenamento" : w.workoutType);

export function RecentWorkouts({ initialData }: Props) {
  const { data: workouts } = useQuery<WorkoutListItem[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions?limit=10");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    initialData,
    staleTime: 60 * 1000,
  });

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Ultimi allenamenti</h2>
        <Link href="/calendar" className="-mr-2 flex h-10 items-center px-2 text-xs text-muted-foreground active:text-foreground">
          Storico <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!workouts?.length ? (
        <p className="rounded-3xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Ancora nessun allenamento: il primo parte dalla card qui sopra.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border/60 bg-card">
          {workouts.slice(0, 5).map((workout) => {
            const date = new Date(workout.startedAt);
            const prs = workout._count?.personalRecords ?? 0;
            return (
              <li key={workout.id} className="border-b border-border/50 last:border-0">
                <Link
                  href={workout.run ? `/run/${workout.run.id}` : `/workout/${workout.id}`}
                  className="flex items-center gap-4 px-4 py-3 active:bg-muted/50"
                >
                  <div className="w-10 shrink-0 text-center">
                    <p className="font-display text-2xl font-bold leading-none tabular-nums">{format(date, "d")}</p>
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">
                      {format(date, "MMM", { locale: it })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      <span className="truncate">{workoutTitle(workout)}</span>
                      {prs > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {prs} PR
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="capitalize">{format(date, "EEEE", { locale: it })}</span> ·{" "}
                      {workout.run
                        ? `Corsa · ${formatPace(paceSecondsPerKm(workout.run.distance, workout.run.movingTime))}/km`
                        : `${workout.exercises?.length ?? 0} esercizi · ${workout.totalSets} serie`}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-lg font-semibold tabular-nums">
                    {workout.run ? `${formatKm(workout.run.distance)} km` : formatVolume(workout.totalVolume)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
