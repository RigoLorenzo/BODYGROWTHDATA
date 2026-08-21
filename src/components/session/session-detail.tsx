"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatDate, getMuscleColor, getMuscleLabel, formatClock } from "@/lib/utils";
import { ChevronLeft, Trash2, Star } from "lucide-react";
import { WorkoutSummaryCard } from "./workout-summary-card";
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
}

const setTypeLabel: Record<string, string> = {
  WARMUP: "Riscaldamento",
  WORKING: "Lavoro",
  DROPSET: "Drop Set",
  FAILURE: "Cedimento",
  MYOREP: "Myo-rep",
};

export function SessionDetail({ workout }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prs = workout.personalRecords ?? [];
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/dashboard"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Dettaglio Allenamento</h1>
            <p className="text-sm text-muted-foreground">{formatDate(workout.startedAt)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary card */}
      <WorkoutSummaryCard workout={workout} />

      {/* PRs */}
      {prs.length > 0 && (
        <Card className="border-green-600/30 bg-green-600/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-4 w-4 text-yellow-400" />
              <p className="font-semibold text-sm">Nuovi Personal Records! 🎉</p>
            </div>
            <div className="space-y-1">
              {prs.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{pr.exercise?.name}</span>
                  <Badge variant="success">{pr.recordType}: {pr.value.toFixed(1)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exercises */}
      <div className="space-y-3">
        {workout.exercises.map((ex) => (
          <Card key={ex.id} className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-sm">{ex.exercise?.name}</CardTitle>
                  {ex.exercise?.nameIt && (
                    <p className="text-xs text-muted-foreground">{ex.exercise.nameIt}</p>
                  )}
                </div>
                {ex.exercise?.primaryMuscle && (
                  <Badge
                    style={{
                      background: `${getMuscleColor(ex.exercise.primaryMuscle)}20`,
                      color: getMuscleColor(ex.exercise.primaryMuscle),
                      borderColor: `${getMuscleColor(ex.exercise.primaryMuscle)}40`,
                    }}
                    className="border text-[10px]"
                  >
                    {getMuscleLabel(ex.exercise.primaryMuscle)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5">
                <div className="grid grid-cols-6 gap-2 text-[10px] text-muted-foreground font-medium">
                  <span>Serie</span>
                  <span>Tipo</span>
                  <span className="text-right">Peso</span>
                  <span className="text-right">Reps</span>
                  <span className="text-right">Volume</span>
                  <span className="text-right">Rec.</span>
                </div>
                <Separator />
                {ex.sets.map((set) => (
                  <div key={set.id} className="grid grid-cols-6 gap-2 text-xs">
                    <span className="tabular-nums">{set.setNumber}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {setTypeLabel[set.type] ?? set.type}
                    </span>
                    <span className="text-right tabular-nums">{set.weight ? `${set.weight}kg` : "-"}</span>
                    <span className="text-right tabular-nums">{set.reps ?? "-"}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {(set.volume ?? 0) > 0 ? `${set.volume!.toFixed(0)}kg` : "-"}
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {set.restSeconds ? formatClock(set.restSeconds) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-2">Eliminare l&apos;allenamento?</h3>
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
