"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVolume } from "@/lib/utils";
import type { WeeklyAnalytics } from "@/types";
import { formatDecimal } from "./format";
import { Section, Stat } from "./ui";

/**
 * Carico degli ultimi 28 giorni in palestra: serie di lavoro e serie
 * efficaci (Muscle Volume) accanto al tonnellaggio (Volume Load).
 */
export function WorkloadStats() {
  const { data, isLoading } = useQuery<WeeklyAnalytics>({
    queryKey: ["analytics", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=weekly&weeks=8");
      if (!res.ok) throw new Error("Failed to fetch weekly analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;

  // Ultime 4 settimane = finestra di 28 giorni, la stessa del Progress Score
  const lastFour = (data?.weeks ?? []).slice(-4);
  const workingSets = lastFour.reduce((sum, w) => sum + w.workingSets, 0);
  const effectiveSets = lastFour.reduce(
    (sum, w) => sum + Object.values(w.effectiveSetsByMuscle ?? {}).reduce((a, b) => a + b, 0),
    0
  );
  const tonnage = lastFour.reduce((sum, w) => sum + w.tonnage, 0);

  return (
    <Section title="Carico" hint="Palestra, ultimi 28 giorni">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <Stat label="Serie di lavoro" value={workingSets.toLocaleString("it-IT")} detail={`${Math.round(workingSets / 4)} a settimana`} />
        <Stat label="Serie efficaci" value={formatDecimal(effectiveSets)} detail="Pesate per muscolo" />
        <Stat label="Volume load" value={formatVolume(tonnage)} detail={`${formatVolume(tonnage / 4)} a settimana`} />
        <Stat label="Sedute" value={formatDecimal(data?.trainingFrequency ?? 0)} unit="a settimana" detail="Nelle settimane attive" />
      </div>
    </Section>
  );
}
