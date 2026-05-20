"use client";

import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Star, Clock, Dumbbell, Zap, Share2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMuscleColor, getMuscleLabel, formatVolume, formatWorkoutDuration } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Prisma } from "@prisma/client";

type WorkoutDetail = Prisma.WorkoutSessionGetPayload<{
  include: {
    personalRecords: { include: { exercise: true } };
    exercises: { include: { exercise: true; sets: true } };
  };
}>;

interface Props {
  workout: WorkoutDetail;
  onClose?: () => void;
}

export function WorkoutSummaryCard({ workout, onClose }: Props) {
  const [showExercises, setShowExercises] = useState(false);

  // Aggregate by muscle
  const muscleMap = new Map<string, { sets: number; tonnage: number }>();
  for (const ex of workout.exercises) {
    const muscle = ex.exercise?.primaryMuscle ?? "FULL_BODY";
    const workingSets = ex.sets.filter((s) => s.type !== "WARMUP");
    const tonnage = workingSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
    const existing = muscleMap.get(muscle) ?? { sets: 0, tonnage: 0 };
    muscleMap.set(muscle, { sets: existing.sets + workingSets.length, tonnage: existing.tonnage + tonnage });
  }
  const muscles = Array.from(muscleMap.entries()).sort((a, b) => b[1].tonnage - a[1].tonnage);

  const totalTonnage = muscles.reduce((sum, [, v]) => sum + v.tonnage, 0);
  const prs = workout.personalRecords ?? [];
  const dateLabel = format(new Date(workout.startedAt), "EEEE d MMMM yyyy", { locale: it });
  const duration = formatWorkoutDuration(new Date(workout.startedAt), workout.endedAt ? new Date(workout.endedAt) : undefined);

  const handleShare = async () => {
    const muscleText = muscles.map(([m, v]) => `${getMuscleLabel(m)}: ${v.sets} serie`).join(" | ");
    const text = `💪 Allenamento completato!\n📅 ${dateLabel}\n⏱ ${duration} · 🏋️ ${formatVolume(totalTonnage)} tonnellaggio · ${workout.totalSets ?? 0} serie\n${muscleText}\n\n#BODYGROWTH #Fitness #Workout`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Il mio allenamento", text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast({ title: "Testo copiato!", description: "Incollalo dove vuoi condividerlo." });
    }
  };

  return (
    <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-white/10 shadow-2xl">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Bodygrowth</p>
          <p className="text-sm text-white/60 mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {prs.length > 0 && (
            <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-2.5 py-1">
              <Star className="h-3 w-3 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">{prs.length} PR!</span>
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <X className="h-3.5 w-3.5 text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-3 gap-px mx-5 mb-4">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <Clock className="h-4 w-4 text-white/40 mx-auto mb-1" />
          <p className="text-xl font-bold text-white tabular-nums">{duration}</p>
          <p className="text-[10px] text-white/40">Durata</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <Zap className="h-4 w-4 text-white/40 mx-auto mb-1" />
          <p className="text-xl font-bold text-white tabular-nums">{formatVolume(totalTonnage)}</p>
          <p className="text-[10px] text-white/40">Tonnellaggio</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <Dumbbell className="h-4 w-4 text-white/40 mx-auto mb-1" />
          <p className="text-xl font-bold text-white tabular-nums">{workout.totalSets ?? 0}</p>
          <p className="text-[10px] text-white/40">Serie</p>
        </div>
      </div>

      {/* Muscle breakdown */}
      {muscles.length > 0 && (
        <div className="px-5 mb-4">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 font-medium">Muscoli allenati</p>
          <div className="flex flex-wrap gap-1.5">
            {muscles.map(([muscle, { sets }]) => (
              <div
                key={muscle}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: `${getMuscleColor(muscle)}20`,
                  borderWidth: 1,
                  borderColor: `${getMuscleColor(muscle)}50`,
                  color: getMuscleColor(muscle),
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getMuscleColor(muscle) }} />
                {getMuscleLabel(muscle)} · {sets}×
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise list (collapsible) */}
      <div className="px-5 mb-4">
        <button
          className="w-full flex items-center justify-between text-[10px] text-white/30 uppercase tracking-wider font-medium pb-2"
          onClick={() => setShowExercises((v) => !v)}
        >
          <span>Esercizi ({workout.exercises.length})</span>
          {showExercises ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showExercises && (
          <div className="space-y-1">
            {workout.exercises.map((ex) => {
              const workingSets = ex.sets.filter((s) => s.type !== "WARMUP");
              const maxWeight = workingSets.length > 0 ? Math.max(...workingSets.map((s) => s.weight ?? 0)) : 0;
              const maxReps = workingSets.length > 0 ? Math.max(...workingSets.map((s) => s.reps ?? 0)) : 0;
              return (
                <div key={ex.id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-white/70 truncate flex-1">{ex.exercise?.name}</span>
                  <span className="text-xs text-white/40 shrink-0 ml-2 tabular-nums">
                    {workingSets.length}× {maxWeight > 0 ? `${maxWeight}kg` : ""}{maxWeight > 0 && maxReps > 0 ? " × " : ""}{maxReps > 0 ? `${maxReps} reps` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-white/10 hover:bg-white/20 text-white border-0"
          onClick={handleShare}
        >
          <Share2 className="h-3.5 w-3.5 mr-1.5" />
          Condividi
        </Button>
        {onClose && (
          <Button
            size="sm"
            className="flex-1 bg-white text-zinc-900 hover:bg-white/90 border-0"
            onClick={onClose}
          >
            Chiudi
          </Button>
        )}
      </div>
    </div>
  );
}
