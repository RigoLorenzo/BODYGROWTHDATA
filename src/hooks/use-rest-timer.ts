"use client";

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/store/session-store";

export function useRestTimer() {
  const { restTimer, tickRestTimer, stopRestTimer } = useSessionStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restTimer?.active) {
      intervalRef.current = setInterval(() => {
        tickRestTimer();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [restTimer?.active, tickRestTimer]);

  useEffect(() => {
    if (restTimer && restTimer.remaining === 0 && !restTimer.active) {
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [restTimer]);

  return {
    restTimer,
    isActive: restTimer?.active ?? false,
    remaining: restTimer?.remaining ?? 0,
    total: restTimer?.seconds ?? 0,
    progress: restTimer ? (restTimer.remaining / restTimer.seconds) * 100 : 0,
    stop: stopRestTimer,
  };
}
