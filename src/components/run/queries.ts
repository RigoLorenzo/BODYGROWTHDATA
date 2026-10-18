"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MiFitnessStatus, RunDetail, RunListItem, RunStats, StravaStatus } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

/** Messaggio d'errore leggibile da una risposta API */
export async function apiError(res: Response, fallback = "Operazione non riuscita"): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export const useRunStats = () =>
  useQuery<RunStats>({ queryKey: ["runs", "stats"], queryFn: () => getJson("/api/runs/stats"), staleTime: 60_000 });

export const useRuns = () =>
  useQuery<RunListItem[]>({ queryKey: ["runs", "list"], queryFn: () => getJson("/api/runs?limit=100"), staleTime: 60_000 });

export const useRun = (id: string) =>
  useQuery<RunDetail>({ queryKey: ["runs", "detail", id], queryFn: () => getJson(`/api/runs/${id}`) });

export const useStravaStatus = () =>
  useQuery<StravaStatus>({ queryKey: ["strava"], queryFn: () => getJson("/api/integrations/strava") });

export const useMiFitnessStatus = () =>
  useQuery<MiFitnessStatus>({ queryKey: ["mifitness"], queryFn: () => getJson("/api/integrations/mifitness") });

/**
 * Dopo ogni modifica alle corse: sezione corsa, home, calendario, streak e benessere.
 * `removedId`: corsa appena eliminata, il cui dettaglio non va ricaricato.
 */
export function useInvalidateRuns() {
  const qc = useQueryClient();
  return (removedId?: string) => {
    if (removedId) qc.removeQueries({ queryKey: ["runs", "detail", removedId], exact: true });
    return Promise.all(
      [["runs"], ["strava"], ["mifitness"], ["sessions"], ["analytics"], ["wellness"]].map((queryKey) =>
        qc.invalidateQueries({
          queryKey,
          predicate: (q) => !(removedId && q.queryKey[1] === "detail" && q.queryKey[2] === removedId),
        })
      )
    );
  };
}
