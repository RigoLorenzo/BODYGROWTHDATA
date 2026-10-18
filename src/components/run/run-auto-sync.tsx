"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateRuns } from "./queries";
import { syncMiFitness } from "./mifitness-sync";

const STORAGE_KEY = "bg:mifitness-auto-sync";
/** All'apertura non si ripete se l'ultima è più recente di così */
const OPEN_MIN_INTERVAL_MS = 5 * 60_000;
/** Con l'app in primo piano */
const INTERVAL_MS = 15 * 60_000;
const RETRY_BASE_MS = 30_000;
const MAX_RETRIES = 4;

function lastSuccess(): number {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function markSuccess() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage non disponibile: il server limita comunque la frequenza
  }
}

/** 30 s, 60 s, 2 min, 4 min (± 20%), mai oltre l'intervallo normale */
const backoff = (attempt: number) =>
  Math.min(INTERVAL_MS, RETRY_BASE_MS * 2 ** (attempt - 1)) * (0.8 + Math.random() * 0.4);

/**
 * Scarica le corse nuove e i dati benessere da Mi Fitness (se collegato)
 * all'apertura dell'app e ogni 15 minuti finché resta in primo piano. In
 * background si ferma. Gli errori sono silenziosi: si riprova con attese
 * crescenti; se il collegamento
 * è scaduto lo stato si aggiorna e la sezione Corsa propone di ricollegare.
 */
export function RunAutoSync() {
  const invalidate = useInvalidateRuns();
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let disposed = false;

    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!disposed) timer = setTimeout(run, delay);
    };

    async function run() {
      if (document.visibilityState !== "visible") return; // riparte al rientro
      const outcome = await syncMiFitness({ auto: true });
      if (disposed) return;

      if (outcome.ok) {
        failures = 0;
        markSuccess();
        if (outcome.wellness) void qc.invalidateQueries({ queryKey: ["wellness"] });
        if (outcome.imported) void invalidate();
        else if (!outcome.skipped) void qc.invalidateQueries({ queryKey: ["mifitness"] });
        schedule(INTERVAL_MS);
        return;
      }
      if (outcome.reconnect) {
        // Token scaduto: inutile insistere, la pagina mostra l'avviso
        void qc.invalidateQueries({ queryKey: ["mifitness"] });
        schedule(INTERVAL_MS);
        return;
      }
      failures = outcome.retryable ? failures + 1 : MAX_RETRIES + 1;
      if (failures <= MAX_RETRIES) {
        schedule(backoff(failures));
      } else {
        failures = 0;
        schedule(INTERVAL_MS);
      }
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        clearTimeout(timer);
        return;
      }
      const due = Date.now() - lastSuccess() >= INTERVAL_MS;
      schedule(due || failures > 0 ? 0 : INTERVAL_MS - (Date.now() - lastSuccess()));
    };

    const onOnline = () => {
      if (failures > 0) schedule(0);
    };

    // Apertura: subito, salvo una sincronizzazione appena fatta
    const sinceLast = Date.now() - lastSuccess();
    schedule(sinceLast < OPEN_MIN_INTERVAL_MS ? INTERVAL_MS - sinceLast : 0);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
