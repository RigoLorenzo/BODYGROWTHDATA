import { DiffBadge } from "@/components/analytics/compare";
import type { DiffTone } from "@/lib/compare";
import { cn } from "@/lib/utils";

export interface StatCompare {
  diff: number;
  format: (n: number) => string;
  /** Deciso da `diffTone` (lib/compare): niente confronto senza dati, grigio a inizio periodo */
  tone: DiffTone;
}

/** Numero grande con etichetta piccola sopra, unità e (facoltativo) il confronto col periodo prima */
export function StatTile({
  label,
  value,
  unit,
  detail,
  compare,
  size = "md",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  detail?: React.ReactNode;
  compare?: StatCompare | null;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 flex items-baseline gap-1 font-display font-bold tabular-nums leading-tight",
          size === "lg" ? "text-[32px]" : "text-2xl"
        )}
      >
        {value}
        {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
      </p>
      {compare && (
        <p className="text-xs">
          <DiffBadge diff={compare.diff} format={compare.format} tone={compare.tone} />
        </p>
      )}
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
