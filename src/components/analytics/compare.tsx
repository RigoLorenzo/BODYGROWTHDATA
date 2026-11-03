import { ArrowDownRight, ArrowUpRight, Equal, Hourglass } from "lucide-react";
import type { CompareContext } from "@/lib/compare";
import { cn } from "@/lib/utils";

export { compareContext, type CompareContext } from "@/lib/compare";

/**
 * Confronti in parole, non in percentuali: "3 allenamenti in più rispetto a
 * ottobre, allo stesso giorno". Chi guarda capisce subito con cosa si
 * confronta e se sta andando meglio o peggio.
 */

const TONE = {
  up: { inverse: "text-lime-400 dark:text-lime-600", card: "text-lime-700 dark:text-lime-400" },
  down: { inverse: "text-red-300 dark:text-red-600", card: "text-red-600 dark:text-red-400" },
  same: { inverse: "text-background/70", card: "text-muted-foreground" },
};

/**
 * La frase del confronto sotto il numero principale. `noun` dà il nome alla
 * differenza ("allenamenti", "km"…), `format` scrive la quantità.
 */
export function CompareLine({
  diff,
  previous,
  ctx,
  noun,
  format: write = (n) => String(n),
  inverse = false,
}: {
  diff: number;
  /** valore del periodo prima: se è zero non c'è nulla con cui confrontare */
  previous: number;
  ctx: CompareContext | null;
  noun: (n: number) => string;
  format?: (n: number) => string;
  inverse?: boolean;
}) {
  if (!ctx || (previous <= 0 && !ctx.early)) return null;
  const surface = inverse ? "inverse" : "card";
  if (ctx.early) {
    return (
      <p className={cn("mt-3 flex items-center gap-1.5 text-sm", TONE.same[surface])}>
        <Hourglass className="h-4 w-4 shrink-0" aria-hidden />
        {ctx.name} è appena iniziat{ctx.name === "La settimana" ? "a" : "o"}: il confronto arriva tra qualche giorno.
      </p>
    );
  }
  const direction = Math.abs(diff) < 1e-9 ? "same" : diff > 0 ? "up" : "down";
  const Icon = direction === "same" ? Equal : direction === "up" ? ArrowUpRight : ArrowDownRight;
  const amount = Math.abs(diff);
  return (
    <p className="mt-3 flex items-start gap-1.5 text-sm">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE[direction][surface])} aria-hidden />
      <span>
        {direction === "same" ? (
          <span className={cn("font-semibold", TONE.same[surface])}>Nessuna differenza</span>
        ) : (
          <span className={cn("font-semibold", TONE[direction][surface])}>
            {write(amount)} {noun(amount)} in {direction === "up" ? "più" : "meno"}
          </span>
        )}{" "}
        <span className="opacity-70">{ctx.against}</span>
      </span>
    </p>
  );
}

/**
 * Differenza compatta sotto un valore secondario: freccia e quantità con
 * l'unità ("+12 km", "−3h"). Niente percentuali.
 */
export function DiffBadge({
  diff,
  format: write,
  inverse = false,
  hidden = false,
}: {
  diff: number;
  format: (n: number) => string;
  inverse?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;
  const surface = inverse ? "inverse" : "card";
  const direction = Math.abs(diff) < 1e-9 ? "same" : diff > 0 ? "up" : "down";
  const Icon = direction === "same" ? Equal : direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", TONE[direction][surface])}>
      <Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden />
      {direction === "same" ? "uguale" : `${direction === "up" ? "+" : "−"}${write(Math.abs(diff))}`}
      <span className="sr-only">{direction === "up" ? " in più" : direction === "down" ? " in meno" : ""}</span>
    </span>
  );
}
