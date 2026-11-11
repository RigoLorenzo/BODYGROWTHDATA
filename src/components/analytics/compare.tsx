import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

import type { DiffTone } from "@/lib/compare";

export { compareContext, diffTone, type CompareContext, type DiffTone } from "@/lib/compare";

const TONE: Record<DiffTone, { inverse: string; card: string }> = {
  good: { inverse: "text-success-inverse", card: "text-success" },
  bad: { inverse: "text-red-300 dark:text-red-600", card: "text-red-600 dark:text-red-400" },
  // Calo a inizio periodo: si vede, ma senza allarme
  soft: { inverse: "text-background/60", card: "text-muted-foreground" },
  same: { inverse: "text-background/60", card: "text-muted-foreground" },
};

/**
 * Differenza col periodo prima: freccia e quantità con l'unità ("+12 km",
 * "−3h"). Il colore lo decide `diffTone` (lib/compare): verde se va meglio,
 * rosso se va peggio, grigio se è presto per dirlo.
 */
export function DiffBadge({
  diff,
  format: write,
  tone: kind,
  inverse = false,
}: {
  diff: number;
  format: (n: number) => string;
  tone: DiffTone;
  inverse?: boolean;
}) {
  const surface = inverse ? "inverse" : "card";
  const same = kind === "same";
  const up = diff > 0;
  const tone = TONE[kind];
  const Icon = same ? Equal : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", tone[surface])}>
      <Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />
      {same ? "uguale" : `${up ? "+" : "−"}${write(Math.abs(diff))}`}
      <span className="sr-only">{same ? "" : up ? " in più" : " in meno"}</span>
    </span>
  );
}
