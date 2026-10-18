import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/wellness/insights";

const ICON = { good: TrendingUp, bad: TrendingDown, neutral: Minus };
const LABEL = { good: "Positivo", bad: "Da tenere d'occhio", neutral: "Neutro" };

/** Osservazioni con icona ed etichetta: il colore non è mai l'unico segnale */
export function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="space-y-3">
      {findings.map((f) => {
        const Icon = ICON[f.tone];
        return (
          <li key={f.text} className="flex gap-3 text-sm">
            <span
              aria-label={LABEL[f.tone]}
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                f.tone === "good" && "bg-lime-500/15 text-lime-700 dark:text-lime-400",
                f.tone === "bad" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                f.tone === "neutral" && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span>{f.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
