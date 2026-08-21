"use client";

import { motion } from "framer-motion";
import { useSessionTimers } from "@/hooks/use-rest-timer";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Recupero in corso: il timer conta in salita da 0.
 * Si ferma quando premi "Ricomincia" e il tempo finisce nel totale recuperi.
 */
export function RestTimerOverlay() {
  const { rest, restElapsed, restTarget, endRest } = useSessionTimers();
  const activeSession = useSessionStore((s) => s.activeSession);

  if (!rest) return null;

  const exercise = activeSession?.exercises.find((e) => e.id === rest.exerciseId);
  const isExerciseRest = rest.kind === "EXERCISE";
  const target = restTarget || 90;
  const progress = Math.min(100, (restElapsed / target) * 100);
  const reached = restElapsed >= target;
  const circumference = 2 * Math.PI * 44;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 250 }}
      className="fixed bottom-20 md:bottom-4 left-4 right-4 z-40"
    >
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Cronometro circolare */}
          <div className="relative shrink-0">
            <svg className="h-[100px] w-[100px] -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={reached ? "#22c55e" : "#f59e0b"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress / 100)}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold tabular-nums", reached && "text-green-400")}>
                {clock(restElapsed)}
              </span>
              <span className="text-[10px] text-muted-foreground">obiettivo {clock(target)}</span>
            </div>
          </div>

          {/* Controlli */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-semibold">
                {isExerciseRest ? "Recupero tra esercizi" : "Recupero tra le serie"}
              </p>
              {exercise && (
                <p className="text-xs text-muted-foreground truncate">
                  dopo {exercise.exerciseNameIt ?? exercise.exerciseName}
                </p>
              )}
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={endRest}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {isExerciseRest ? "Ricomincia esercizio" : "Riprendi la serie"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Il tempo di recupero viene salvato con l&apos;allenamento.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
