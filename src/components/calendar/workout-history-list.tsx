"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative, formatVolume, formatWorkoutDuration, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import { Star, Dumbbell, CalendarDays, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";

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
  programDayId?: string | null;
  notes?: string | null;
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

export function WorkoutHistoryList() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activeMuscle, setActiveMuscle] = useState("");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<WorkoutItem[]>({
      queryKey: ["sessions", "history", activeMuscle],
      queryFn: async ({ pageParam }) => {
        const offset = (pageParam as number) ?? 0;
        const params = new URLSearchParams({ limit: "20", offset: String(offset) });
        if (activeMuscle) params.set("muscle", activeMuscle);
        const res = await fetch(`/api/sessions?${params}`);
        if (!res.ok) throw new Error("Failed to fetch sessions");
        return res.json();
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === 20 ? allPages.length * 20 : undefined,
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
      {/* Muscle filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {MUSCLE_FILTERS.map((f) => {
          const isActive = activeMuscle === f.value;
          const color = f.value ? getMuscleColor(f.value) : null;
          return (
            <button
              key={f.value}
              onClick={() => setActiveMuscle(f.value)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={
                isActive && color
                  ? { background: `${color}25`, color, borderWidth: 1, borderColor: `${color}50` }
                  : isActive
                  ? { background: "hsl(var(--foreground))", color: "hsl(var(--background))" }
                  : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !allWorkouts.length ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeMuscle ? `Nessun allenamento per ${getMuscleLabel(activeMuscle)}.` : "Nessun allenamento ancora."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupByMonth(allWorkouts).map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map((workout) => (
                  <Link key={workout.id} href={`/workout/${workout.id}`}>
                    <Card className="border-border/50 hover:border-border transition-colors active:scale-[0.99]">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="font-medium text-sm truncate">
                                {workout.workoutType === "CUSTOM"
                                  ? workout.exercises?.[0]?.exercise?.name ?? "Allenamento"
                                  : workout.workoutType}
                              </p>
                              {(workout._count?.personalRecords ?? 0) > 0 && (
                                <Badge variant="success" className="shrink-0">
                                  <Star className="h-2.5 w-2.5 mr-1" />
                                  PR
                                </Badge>
                              )}
                              {workout.programDayId && (
                                <Badge variant="outline" className="shrink-0 text-[9px] border-blue-500/40 text-blue-400 bg-blue-500/10">
                                  <CalendarDays className="h-2.5 w-2.5 mr-1" />
                                  Piano
                                </Badge>
                              )}
                              {workout.notes?.includes("[DEVIAZIONE") && (
                                <Badge variant="outline" className="shrink-0 text-[9px] border-orange-500/40 text-orange-400 bg-orange-500/10">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                                  Deviato
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {formatRelative(workout.startedAt)}
                              {workout.endedAt && (
                                <span className="ml-2 text-muted-foreground/70">
                                  · {formatWorkoutDuration(new Date(workout.startedAt), new Date(workout.endedAt))}
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {workout.exercises?.slice(0, 3).map((ex) => (
                                <span
                                  key={ex.id}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full border"
                                  style={{
                                    borderColor: `${getMuscleColor(ex.exercise?.primaryMuscle ?? "")}40`,
                                    color: getMuscleColor(ex.exercise?.primaryMuscle ?? ""),
                                  }}
                                >
                                  {ex.exercise?.name}
                                </span>
                              ))}
                              {(workout.exercises?.length ?? 0) > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{(workout.exercises?.length ?? 0) - 3}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">{formatVolume(workout.totalVolume)}</p>
                            <p className="text-xs text-muted-foreground">{workout.totalSets} serie</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className="py-2">
            {isFetchingNextPage && (
              <div className="space-y-2">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            )}
            {!hasNextPage && allWorkouts.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">Hai visto tutto</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
