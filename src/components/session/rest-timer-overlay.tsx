"use client";

import { motion } from "framer-motion";
import { useRestTimer } from "@/hooks/use-rest-timer";
import { Button } from "@/components/ui/button";
import { X, SkipForward } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";

export function RestTimerOverlay() {
  const { restTimer, remaining, progress, stop } = useRestTimer();
  const { startRestTimer } = useSessionStore();

  if (!restTimer) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference * (1 - progress / 100);

  const addTime = (delta: number) => {
    const next = Math.max(5, remaining + delta);
    startRestTimer(restTimer.exerciseId, restTimer.setNumber, next);
  };

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
          {/* Circular timer */}
          <div className="relative shrink-0">
            <svg className="h-[100px] w-[100px] -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={remaining <= 10 ? "#ef4444" : "#22c55e"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-2xl font-bold tabular-nums", remaining <= 10 && "text-red-400")}>
                {minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : seconds}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold">Recupero</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => addTime(-30)}
                className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
              >
                -30s
              </button>
              <button
                onClick={() => addTime(30)}
                className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
              >
                +30s
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs"
                onClick={stop}
              >
                <SkipForward className="h-3.5 w-3.5 mr-1" />
                Salta
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={stop}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
