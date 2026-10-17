"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useSessionStore, isFilledUnconfirmed } from "@/store/session-store";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useSessionDraftSync } from "@/hooks/use-session-draft-sync";
import { Button } from "@/components/ui/button";
import { ExerciseCard } from "./exercise-card";
import { ExerciseSelector } from "./exercise-selector";
import { formatVolume } from "@/lib/utils";
import { calculateSessionVolume } from "@/lib/volume-calculator";
import { Plus, CheckCircle, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ActiveSession } from "@/types";
import { buildActiveExercise, fetchExerciseHistory } from "@/lib/active-exercise";
import type { Prisma } from "@prisma/client";

type CompletedWorkout = Prisma.WorkoutSessionGetPayload<{
  include: {
    personalRecords: { include: { exercise: true } };
    exercises: { include: { exercise: true; sets: true } };
  };
}>;

interface Props {
  session: ActiveSession;
  /** Chiamata quando l'allenamento è stato salvato: la pagina mostra il riepilogo */
  onCompleted: (workout: CompletedWorkout) => void;
}

/** Minuti trascorsi: si aggiorna da solo senza ridisegnare la lista esercizi */
function ElapsedMinutes({ startedAt }: { startedAt: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  return <>{minutes} min</>;
}

export function ActiveWorkoutView({ session, onCompleted }: Props) {
  const router = useRouter();
  const addExercise = useSessionStore((s) => s.addExercise);
  const endSession = useSessionStore((s) => s.endSession);
  const { completeWorkout, isCompleting } = useWorkoutSession();
  useSessionDraftSync();
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  const abandonMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to abandon");
    },
    onSuccess: () => {
      endSession();
      router.replace("/dashboard");
      toast({ title: "Allenamento abbandonato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile abbandonare l'allenamento", variant: "destructive" });
    },
  });

  const allSets = session.exercises.flatMap((ex) => ex.sets);
  const doneSets = allSets.filter((s) => s.completed).length;
  const totalVolume = calculateSessionVolume(
    session.exercises.map((ex) => ({ sets: ex.sets.filter((s) => s.completed) }))
  );

  const handleAddExercise = useCallback(
    async (exercise: { id: string; name: string; nameIt?: string | null }) => {
      setShowExerciseSelector(false);
      // Stesse serie (e stessi pesi) dell'ultima volta, se l'hai già fatto
      const history = await fetchExerciseHistory([exercise.id]);
      addExercise(
        buildActiveExercise(
          {
            id: `ex-${Date.now()}`,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            exerciseNameIt: exercise.nameIt,
            orderIndex: session.exercises.length,
          },
          history[exercise.id]
        )
      );
    },
    [addExercise, session.exercises.length]
  );

  const doComplete = async () => {
    try {
      const data = await completeWorkout(session.id);
      onCompleted(data as CompletedWorkout);
      toast({ title: "Allenamento completato! 💪", description: "Ottimo lavoro!" });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare l'allenamento", variant: "destructive" });
    }
  };

  const handleFinish = () => {
    const nothingToSave = !allSets.some((s) => s.completed || isFilledUnconfirmed(s));
    if (nothingToSave) {
      setShowFinishConfirm(true);
      return;
    }
    doComplete();
  };

  return (
    <div className="bg-background pb-8">
      {/* Header: fondo pieno, niente blur, così lo scroll resta fluido sui telefoni */}
      <div className="sticky top-0 z-30 bg-background border-b border-border/60">
        <div className="container max-w-2xl mx-auto px-3 py-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abbandona allenamento"
            onClick={() => setShowAbandonConfirm(true)}
            className="text-muted-foreground h-9 w-9 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{session.programDayName ?? "Allenamento libero"}</p>
            <p className="text-xs text-muted-foreground tabular-nums truncate">
              <span className="font-semibold text-foreground">
                {doneSets}/{allSets.length}
              </span>{" "}
              serie · {formatVolume(totalVolume)} · <ElapsedMinutes startedAt={session.startedAt} />
            </p>
          </div>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white h-9 shrink-0"
            onClick={handleFinish}
            disabled={isCompleting}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            {isCompleting ? "Salvataggio..." : "Fine"}
          </Button>
        </div>
      </div>

      {/* Exercise list */}
      <div className="container max-w-2xl mx-auto px-3 py-3 space-y-3">
        {session.exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}

        {session.exercises.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Nessun esercizio</p>
            <p className="text-sm">Aggiungi il primo esercizio per iniziare</p>
          </div>
        )}

        <Button
          variant="outline"
          className="w-full h-11 border-dashed"
          onClick={() => setShowExerciseSelector(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Esercizio
        </Button>
      </div>

      {/* Exercise Selector */}
      <AnimatePresence>
        {showExerciseSelector && (
          <ExerciseSelector
            onSelect={handleAddExercise}
            onClose={() => setShowExerciseSelector(false)}
          />
        )}
      </AnimatePresence>

      {/* Finish confirm */}
      <AnimatePresence>
        {showFinishConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowFinishConfirm(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-2">Terminare l&apos;allenamento?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Non hai registrato nessuna serie: l&apos;allenamento verrà salvato vuoto. Vuoi terminare comunque?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowFinishConfirm(false)}>
                  Continua
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setShowFinishConfirm(false);
                    doComplete();
                  }}
                >
                  Termina
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Abandon confirm */}
      <AnimatePresence>
        {showAbandonConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowAbandonConfirm(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-2">Abbandonare l&apos;allenamento?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                I progressi non verranno salvati. Sei sicuro?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowAbandonConfirm(false)}>
                  Continua
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={abandonMutation.isPending}
                  onClick={() => abandonMutation.mutate()}
                >
                  {abandonMutation.isPending ? "Uscita..." : "Abbandona"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
