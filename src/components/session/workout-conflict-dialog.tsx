"use client";

import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useServerActiveSession, useWorkoutSession } from "@/hooks/use-workout-session";
import { Play, Trash2 } from "lucide-react";

/**
 * Un allenamento è già aperto sul server (tipicamente avviato da un altro
 * dispositivo o browser) e blocca l'avvio di quello nuovo: qui si sceglie se
 * riprenderlo o scartarlo e partire comunque.
 */
export function WorkoutConflictDialog() {
  const conflict = useUIStore((s) => s.workoutConflict);
  const setWorkoutConflict = useUIStore((s) => s.setWorkoutConflict);
  const { resume, discard } = useServerActiveSession();
  const { startWorkout } = useWorkoutSession();

  const close = () => setWorkoutConflict(null);

  const handleResume = () => {
    if (!conflict) return;
    resume.mutate(conflict.sessionId, { onSuccess: close });
  };

  const handleDiscardAndStart = () => {
    if (!conflict) return;
    const { retry } = conflict;
    discard.mutate(conflict.sessionId, {
      onSuccess: () => {
        close();
        startWorkout(
          retry.data as Parameters<typeof startWorkout>[0],
          retry.planExercises as Parameters<typeof startWorkout>[1]
        );
      },
    });
  };

  const pending = resume.isPending || discard.isPending;

  return (
    <AnimatePresence>
      {conflict && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={close}
        >
          <motion.div
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            exit={{ y: 50 }}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-2">Hai già un allenamento aperto</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Iniziato alle{" "}
              <span className="font-semibold text-foreground">
                {format(new Date(conflict.startedAt), "HH:mm 'del' d MMMM", { locale: it })}
              </span>
              {conflict.exerciseCount > 0
                ? ` con ${conflict.exerciseCount} esercizi salvati.`
                : ", senza esercizi salvati."}{" "}
              Puoi riprenderlo qui oppure scartarlo e iniziarne uno nuovo.
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={handleResume} disabled={pending}>
                <Play className="h-4 w-4 mr-1.5" />
                {resume.isPending ? "Ripresa..." : "Riprendi quello in corso"}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDiscardAndStart}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {discard.isPending ? "Attendere..." : "Scarta e inizia nuovo"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={close} disabled={pending}>
                Annulla
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
