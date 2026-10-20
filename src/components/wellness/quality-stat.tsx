import { Stat } from "@/components/analytics/ui";
import { sleepEfficiency } from "@/lib/wellness/insights";
import type { SleepJson } from "@/lib/wellness/types";

const scoreLabel = (s: number) => (s >= 85 ? "ottimo" : s >= 70 ? "buono" : s >= 60 ? "discreto" : "scarso");
const efficiencyLabel = (e: number) => (e >= 0.9 ? "ottima" : e >= 0.85 ? "buona" : e >= 0.75 ? "discreta" : "scarsa");

/** Punteggio se l'orologio lo dà, altrimenti efficienza (addormentato / a letto) */
export function QualityStat({ night }: { night: SleepJson }) {
  if (night.score != null) return <Stat label="Punteggio" value={night.score} detail={scoreLabel(night.score)} />;
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
