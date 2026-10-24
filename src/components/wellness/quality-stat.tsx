import { Stat } from "@/components/analytics/ui";
import { sleepEfficiency } from "@/lib/wellness/insights";
import type { SleepJson } from "@/lib/wellness/types";

const efficiencyLabel = (e: number) => (e >= 0.9 ? "ottima" : e >= 0.85 ? "buona" : e >= 0.75 ? "discreta" : "scarsa");

/** Efficienza della notte (addormentato / a letto); il punteggio è nella pagina Sonno */
export function QualityStat({ night }: { night: SleepJson }) {
  const efficiency = sleepEfficiency(night);
  return (
    <Stat
      label="Efficienza"
      value={efficiency != null ? Math.round(efficiency * 100) : "—"}
      unit={efficiency != null ? "%" : undefined}
      detail={efficiency != null ? efficiencyLabel(efficiency) : undefined}
    />
  );
}
