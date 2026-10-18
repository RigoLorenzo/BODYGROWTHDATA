"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActivityItem } from "@/lib/insights";

type ActivityJson = Omit<ActivityItem, "startedAt"> & { startedAt: string };

/** Tutte le sedute (palestra e corsa) per le statistiche calcolate nel browser */
export function useActivity() {
  return useQuery<ActivityItem[]>({
    // Sotto "analytics": si aggiorna con le altre statistiche dopo allenamenti e corse
    queryKey: ["analytics", "activity"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/activity");
      if (!res.ok) throw new Error("Failed to fetch activity");
      const items: ActivityJson[] = await res.json();
      return items.map((i) => ({ ...i, startedAt: new Date(i.startedAt) }));
    },
    staleTime: 60_000,
  });
}

/** Link al dettaglio di una seduta: le corse hanno la loro pagina */
export const activityHref = (i: Pick<ActivityItem, "id" | "runId">) => (i.runId ? `/run/${i.runId}` : `/workout/${i.id}`);
