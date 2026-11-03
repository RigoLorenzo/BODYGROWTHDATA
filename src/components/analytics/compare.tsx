import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

export { compareContext, type CompareContext } from "@/lib/compare";

const TONE = {
  good: { inverse: "text-lime-400 dark:text-lime-600", card: "text-lime-700 dark:text-lime-400" },
  bad: { inverse: "text-red-300 dark:text-red-600", card: "text-red-600 dark:text-red-400" },
  same: { inverse: "text-background/60", card: "text-muted-foreground" },
};

/**
 * Differenza col periodo prima: freccia e quantità con l'unità ("+12 km",
 * "−3h"), verde se va meglio, rosso se va peggio. Per il ritmo vale il
 * contrario: meno secondi al km è meglio.
 */
export function DiffBadge({
  diff,
  format: write,
  inverse = false,
  lowerIsBetter = false,
}: {
  diff: number;
  format: (n: number) => string;
  inverse?: boolean;
  lowerIsBetter?: boolean;
}) {
  const surface = inverse ? "inverse" : "card";
  const same = Math.abs(diff) < 1e-9;
  const up = diff > 0;
  const tone = same ? TONE.same : up !== lowerIsBetter ? TONE.good : TONE.bad;
  const Icon = same ? Equal : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", tone[surface])}>
      <Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />
      {same ? "uguale" : `${up ? "+" : "−"}${write(Math.abs(diff))}`}
      <span className="sr-only">{same ? "" : up ? " in più" : " in meno"}</span>
    </span>
  );
}
