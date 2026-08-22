"use client";

import { useEffect, useRef, useState } from "react";
import {
  useSessionStore,
  getOpenRest,
  getTotalRestSeconds,
  getActiveSeconds,
  getPhase,
  getCurrentExercise,
  getNextExercise,
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
  const startExercise = useSessionStore((s) => s.startExercise);
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

  // Fase corrente: sempre legata a un esercizio preciso (o IDLE se non ce n'è uno)
  const phase = getPhase(activeSession);
  const currentExercise = getCurrentExercise(activeSession);
  const nextExercise = getNextExercise(activeSession);

  // Da quanto dura la fase: il recupero in corso, oppure il lavoro sull'esercizio
  // attuale da quando è iniziato o dall'ultimo recupero chiuso.
  const lastRestEnd = (activeSession?.restIntervals ?? []).reduce(
    (max, r) => (r.endedAt && r.endedAt > max ? r.endedAt : max),
    0
  );
  const workStartedAt = Math.max(lastRestEnd, currentExercise?.startedAt ?? 0);
  const phaseSeconds =
    phase === "REST"
      ? restElapsed
      : phase === "WORK" && workStartedAt
        ? Math.max(0, Math.floor((now - workStartedAt) / 1000))
        : 0;

  return {
    rest,
    isResting: !!rest,
    phase,
    currentExercise,
    nextExercise,
    phaseSeconds,
    restElapsed,
    restTarget,
    totalSeconds,
    restSeconds: getTotalRestSeconds(activeSession, now),
    activeSeconds: getActiveSeconds(activeSession, now),
    endRest,
    startExercise,
    finishExercise,
  };
}
