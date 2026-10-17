"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Dumbbell, CalendarDays, Check } from "lucide-react";
import { getMuscleColor, cn } from "@/lib/utils";
import { useActiveProgram, useStartPlanDay } from "@/hooks/use-active-program";
import type { PlanDay } from "@/types";

interface Props {
  onClose: () => void;
}

/** Scelta del giorno del piano da allenare (o allenamento libero). */
export function StartWorkoutSheet({ onClose }: Props) {
  const { data: active, isLoading: loadingPlan } = useActiveProgram();
  const { startDay, startFree, isLoading } = useStartPlanDay();

  const days = active?.days ?? [];
  const suggested = active?.suggestedDayIndex ?? 0;

  const handleStartDay = (day: PlanDay) => {
    startDay(day);
    onClose();
  };

  const handleFreeWorkout = () => {
    startFree();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-card rounded-t-2xl border-t border-border flex flex-col"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-4 pb-3 shrink-0 flex items-start justify-between">
          <div>
            <h2 className="font-semibold">Che allenamento fai oggi?</h2>
            {active?.program?.name && (
              <p className="text-xs text-muted-foreground">Piano: {active.program.name}</p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 space-y-2">
          {loadingPlan && (
            <p className="py-6 text-center text-sm text-muted-foreground">Caricamento piano...</p>
          )}

          {!loadingPlan && days.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nessun piano attivo: puoi comunque iniziare un allenamento libero.
            </p>
          )}

          {days.map((day, index) => (
            <button
              key={day.id}
              disabled={isLoading}
              onClick={() => handleStartDay(day)}
              className={cn(
                "w-full text-left p-3 rounded-xl border transition-colors active:scale-[0.99]",
                index === suggested
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 hover:border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="font-medium text-sm truncate">
                    Giorno {index + 1} · {day.name}
                  </p>
                </div>
                {index === suggested && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex items-center gap-1">
                    <Check className="h-2.5 w-2.5" />
                    Consigliato
                  </span>
                )}
              </div>

              {day.exercises.length > 0 ? (
                <div className="space-y-0.5 pl-5">
                  {day.exercises.slice(0, 4).map((ex, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground flex-1 truncate">
                        {ex.exercise?.nameIt ?? ex.exercise?.name ?? "Esercizio"}
                      </p>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0">
                        {ex.sets}×{ex.repsMin}–{ex.repsMax}
                      </span>
                      {ex.exercise?.primaryMuscle && (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: getMuscleColor(ex.exercise.primaryMuscle) }}
                        />
                      )}
                    </div>
                  ))}
                  {day.exercises.length > 4 && (
                    <p className="text-[10px] text-muted-foreground/70">
                      +{day.exercises.length - 4} esercizi
                    </p>
                  )}
                </div>
              ) : (
                <p className="pl-5 text-xs text-muted-foreground">Nessun esercizio programmato</p>
              )}
            </button>
          ))}

          <Button
            variant="outline"
            className="w-full h-12 border-dashed"
            onClick={handleFreeWorkout}
            disabled={isLoading}
          >
            <Dumbbell className="h-4 w-4 mr-2" />
            Allenamento libero
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
