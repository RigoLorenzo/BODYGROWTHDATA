"use client";

import { useEffect, useRef, useState } from "react";
import {
  useSessionStore,
  getOpenRest,
  getTotalRestSeconds,
  getActiveSeconds,
} from "@/store/session-store";

/** Orologio a 1 secondo, attivo solo quando c'è un allenamento in corso. */
function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

/**
 * Cronometri della sessione: durata totale, recupero e lavoro effettivo.
 * Tutto è calcolato dai timestamp, quindi resta corretto anche se l'app
 * finisce in background o lo schermo si spegne.
 */
export function useSessionTimers() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const endRest = useSessionStore((s) => s.endRest);
  const resumeExercise = useSessionStore((s) => s.resumeExercise);
  const finishExercise = useSessionStore((s) => s.finishExercise);

  const now = useNow(!!activeSession);
  const rest = getOpenRest(activeSession);
  const vibratedFor = useRef<string | null>(null);

  const restElapsed = rest ? Math.max(0, Math.floor((now - rest.startedAt) / 1000)) : 0;
  const restTarget = rest?.targetSeconds ?? 0;

  // Vibrazione una sola volta al raggiungimento del recupero target
  useEffect(() => {
    if (!rest || !restTarget) return;
    if (restElapsed < restTarget) return;
    if (vibratedFor.current === rest.id) return;
    vibratedFor.current = rest.id;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [rest, restElapsed, restTarget]);

  const totalSeconds = activeSession
    ? Math.max(0, Math.floor((now - new Date(activeSession.startedAt).getTime()) / 1000))
    : 0;

  return {
    rest,
    isResting: !!rest,
    restElapsed,
    restTarget,
    totalSeconds,
    restSeconds: getTotalRestSeconds(activeSession, now),
    activeSeconds: getActiveSeconds(activeSession, now),
    endRest,
    resumeExercise,
    finishExercise,
  };
}

/** Compatibilità con i componenti che leggevano solo il recupero in corso. */
export function useRestTimer() {
  const timers = useSessionTimers();
  return {
    restTimer: timers.rest,
    isActive: timers.isResting,
    elapsed: timers.restElapsed,
    target: timers.restTarget,
    stop: timers.endRest,
  };
}
