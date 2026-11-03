import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Variazione rispetto al periodo prima, leggibile al volo: freccia, valore e
 * colore. `inverse` sulle superfici scure (l'hero), `lowerIsBetter` per il
 * ritmo, dove meno secondi al km vuol dire meglio.
 */
export function Delta({
  value,
  inverse = false,
  lowerIsBetter = false,
  className,
}: {
  /** come da formatDelta: "+12%", "−4%", "×3", "=" */
  value: string | null;
  inverse?: boolean;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  if (!value) return null;
  const flat = value === "=";
  const down = value.startsWith("−");
  const good = flat ? null : down === lowerIsBetter;
  const Icon = flat ? Equal : down ? ArrowDownRight : ArrowUpRight;
  const tone =
    good == null
      ? inverse
        ? "text-background/60"
        : "text-muted-foreground"
      : good
        ? inverse
          ? "text-lime-400 dark:text-lime-600"
          : "text-lime-700 dark:text-lime-400"
        : inverse
          ? "text-red-300 dark:text-red-600"
          : "text-red-600 dark:text-red-400";
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", tone, className)}>
      <Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />
      {flat ? "pari" : value.replace(/^[+−]/, "")}
      <span className="sr-only">{flat ? "" : down ? " in calo" : " in aumento"}</span>
    </span>
  );
}
