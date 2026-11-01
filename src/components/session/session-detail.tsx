"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/analytics/ui";
import { cn, getMuscleColor, getMuscleLabel } from "@/lib/utils";
import { formatNumberIt } from "@/lib/workout-share";
import { ChevronLeft, Trash2, Share2 } from "lucide-react";
import { WorkoutSummaryCard } from "./workout-summary-card";
import { ShareWorkoutDialog } from "./share/share-workout-dialog";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

type WorkoutDetail = Prisma.WorkoutSessionGetPayload<{
  include: {
    personalRecords: { include: { exercise: true } };
    exercises: { include: { exercise: true; sets: true } };
  };
}>;

interface Props {
  workout: WorkoutDetail;
  dayName?: string | null;
}

type ExerciseDetail = WorkoutDetail["exercises"][number];

/** Le serie di un esercizio: carico × ripetizioni e volume, riscaldamento attenuato */
function ExerciseSets({ exercise }: { exercise: ExerciseDetail }) {
  const muscle = exercise.exercise?.primaryMuscle ?? "FULL_BODY";
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-9 w-1 shrink-0 rounded-full" style={{ background: getMuscleColor(muscle) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{exercise.exercise?.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[exercise.exercise?.nameIt, getMuscleLabel(muscle)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="w-10 pb-1 font-medium">#</th>
            <th className="pb-1 font-medium">Serie</th>
            <th className="pb-1 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {exercise.sets.map((set) => {
            const warmup = set.type === "WARMUP";
            const load = set.weight ? `${formatNumberIt(set.weight, 1)} kg × ${set.reps ?? 0}` : set.reps ? `${set.reps} rip.` : "—";
            return (
              <tr key={set.id} className={cn("border-t border-border/60", warmup && "text-muted-foreground")}>
                <td className="py-2 tabular-nums">{set.setNumber}</td>
                <td className="py-2">
                  <span className="font-display text-base font-semibold tabular-nums">{load}</span>
                  {set.type !== "WORKING" && (
                    <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {setTypeLabel[set.type] ?? set.type}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {(set.volume ?? 0) > 0 ? `${formatNumberIt(set.volume!)} kg` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const setTypeLabel: Record<string, string> = {
  WARMUP: "Riscaldamento",
  WORKING: "Lavoro",
  DROPSET: "Drop Set",
  FAILURE: "Cedimento",
  MYOREP: "Myo-rep",
};

export function SessionDetail({ workout, dayName = null }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sessions/${workout.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast({ title: "Allenamento eliminato" });
      router.replace("/dashboard");
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare l'allenamento", variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <header className="flex items-center gap-1">
        <Link
          href="/dashboard"
          aria-label="Indietro"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-3xl font-bold uppercase tracking-wide">Allenamento</h1>
        <button
          type="button"
          aria-label="Condividi allenamento"
          onClick={() => setShareOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted active:scale-95"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Elimina allenamento"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-destructive active:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>
      <ShareWorkoutDialog sessionId={workout.id} open={shareOpen} onOpenChange={setShareOpen} />

      <WorkoutSummaryCard workout={workout} dayName={dayName} />

      <Section title="Serie" hint="Tutte le serie, riscaldamento compreso">
        <div className="space-y-5">
          {workout.exercises.map((ex) => (
            <ExerciseSets key={ex.id} exercise={ex} />
          ))}
        </div>
      </Section>

      {/* Delete confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="w-full max-w-sm rounded-3xl border border-border/60 bg-card p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 font-display text-2xl font-bold uppercase tracking-wide">Eliminare l&apos;allenamento?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Questa azione non può essere annullata.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
