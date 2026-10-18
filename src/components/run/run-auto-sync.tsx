"use client";

import { useEffect } from "react";
import { useInvalidateRuns } from "./queries";

const STORAGE_KEY = "bg:mifitness-auto-sync";
const INTERVAL_MS = 5 * 60_000;

function lastRun(): number {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

/**
 * All'apertura dell'app scarica le corse nuove da Mi Fitness (se collegato),
 * così home, streak e sezione Corsa sono aggiornate senza toccare nulla.
 */
export function RunAutoSync() {
  const invalidate = useInvalidateRuns();

  useEffect(() => {
    if (Date.now() - lastRun() < INTERVAL_MS) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Storage non disponibile: il server limita comunque la frequenza
    }
    fetch("/api/integrations/mifitness/sync?auto=1", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.imported) void invalidate();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
