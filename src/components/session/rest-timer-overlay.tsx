"use client";

import { motion } from "framer-motion";
import { useRestTimer } from "@/hooks/use-rest-timer";
import { Button } from "@/components/ui/button";
import { X, Plus, SkipForward } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { cn } from "@/lib/utils";

export function RestTimerOverlay() {
  const { restTimer, remaining, total, progress, stop } = useRestTimer();
  const { startRestTimer } = useSessionStore();

  if (!restTimer) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference * (1 - progress / 100);

  const addTime = (seconds: number) => {
    startRestTimer(restTimer.exerciseId, restTimer.setNumber, remaining + seconds);
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 250 }}
      className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4"
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
              {[15, 30, 60].map((s) => (
                <button
                  key={s}
                  onClick={() => addTime(s)}
                  className="text-xs px-2 py-1 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
                >
                  +{s}s
                </button>
              ))}
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
