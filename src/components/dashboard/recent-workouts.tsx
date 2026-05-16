"use client";

import { useRecentWorkouts } from "@/hooks/use-workout-session";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative, formatVolume, getMuscleColor } from "@/lib/utils";
import { Dumbbell, Star, ChevronRight } from "lucide-react";

interface WorkoutExercise {
  id: string;
  exercise?: { name: string; primaryMuscle?: string };
}

interface WorkoutListItem {
  id: string;
  workoutType: string;
  startedAt: string | Date;
  totalVolume: number;
  totalSets: number;
  exercises?: WorkoutExercise[];
  _count?: { personalRecords: number };
}
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export function RecentWorkouts() {
  const { data: workouts, isLoading } = useRecentWorkouts();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!workouts?.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nessun allenamento ancora.</p>
          <p className="text-sm text-muted-foreground">Inizia il tuo primo allenamento!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Allenamenti Recenti</h2>
        <Link href="/calendar" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Vedi tutti →
        </Link>
      </div>
      <div className="space-y-3">
        {workouts.slice(0, 5).map((workout: WorkoutListItem) => (
          <Link key={workout.id} href={`/workout/${workout.id}`}>
            <Card className="border-border/50 hover:border-border transition-colors active:scale-[0.99]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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
                    </div>
                    <p className="text-xs text-muted-foreground">{formatRelative(workout.startedAt)}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {workout.exercises?.slice(0, 3).map((ex: WorkoutExercise) => (
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
                        <span className="text-[10px] text-muted-foreground">+{(workout.exercises?.length ?? 0) - 3}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{formatVolume(workout.totalVolume)}</p>
                    <p className="text-xs text-muted-foreground">{workout.totalSets} serie</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
