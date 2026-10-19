"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WellnessProgress, WellnessResponse } from "@/lib/wellness/types";

const PAUSE_MS = 1_000;
const RETRY_MS = 30_000;
const MAX_FAILURES = 3;

/** Un solo ciclo valido alla volta: rimontando la pagina il vecchio si ferma */
let generation = 0;

type Step = { ok: true; saved: number; progress: WellnessProgress } | { ok: false; stop: boolean };

async function step(): Promise<Step> {
  try {
    const res = await fetch("/api/wellness/sync", { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.progress) return { ok: true, saved: body.saved ?? 0, progress: body.progress };
    // Non collegato o token scaduto: inutile insistere
    return { ok: false, stop: res.status === 401 || res.status === 404 };
  } catch {
    return { ok: false, stop: false };
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Finché la pagina Benessere è aperta scarica lo storico un passo dopo
 * l'altro (ogni passo ~40 s lato server) e aggiorna i grafici man mano.
 * In background si ferma; riprende al ritorno o con la sincronizzazione notturna.
 */
export function useWellnessBackfill(data: WellnessResponse | undefined) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<WellnessProgress | null>(null);
  const [active, setActive] = useState(false);
  const shown = progress ?? data?.progress ?? null;
  const needed = !!data?.connected && !data.needsReconnect && !!data.progress && !data.progress.complete;

  useEffect(() => {
    if (!needed) return;
    const id = ++generation;
    const alive = () => id === generation;
    setActive(true);

    (async () => {
      let failures = 0;
      while (alive()) {
        if (document.visibilityState !== "visible") {
          await wait(PAUSE_MS);
          continue;
        }
        const result = await step();
        if (result.ok) {
          failures = 0;
          setProgress(result.progress);
          if (result.saved) await qc.invalidateQueries({ queryKey: ["wellness"] });
          if (result.progress.complete) break;
          await wait(PAUSE_MS);
        } else {
          failures++;
          if (result.stop || failures >= MAX_FAILURES) break;
          await wait(RETRY_MS);
        }
      }
      if (!alive()) return;
      setActive(false);
      void qc.invalidateQueries({ queryKey: ["wellness"] });
    })();

    return () => {
      if (alive()) generation++;
    };
  }, [needed, qc]);

  return { progress: shown, active };
}
