"use client";

import { Check, Dumbbell, Footprints, Shuffle, Trophy, type LucideIcon } from "lucide-react";
import { STYLE_INFO, TRAINING_STYLES, type TrainingStyle } from "@/lib/training-style";
import { cn } from "@/lib/utils";

const ICONS: Record<TrainingStyle, LucideIcon> = {
  BODYBUILDING: Dumbbell,
  POWERLIFTING: Trophy,
  RUNNING: Footprints,
  HYBRID: Shuffle,
};

/**
 * Scelta dello stile di allenamento: quattro schede, quella scelta si apre
 * e spiega in parole semplici quando stai migliorando e cosa guarda l'app.
 */
export function TrainingStylePicker({ value, onChange }: { value: TrainingStyle | null; onChange: (style: TrainingStyle) => void }) {
  return (
    <div role="radiogroup" aria-label="Stile di allenamento" className="space-y-2">
      {TRAINING_STYLES.map((style) => {
        const info = STYLE_INFO[style];
        const Icon = ICONS[style];
        const selected = value === style;
        return (
          <div
            key={style}
            className={cn(
              "overflow-hidden rounded-2xl border transition-colors",
              selected ? "border-foreground bg-card" : "border-border/60 bg-muted/40"
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(style)}
              className="flex w-full items-center gap-3 p-4 text-left active:bg-muted/60"
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                  selected ? "bg-foreground text-background" : "bg-background text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-bold uppercase leading-tight">{info.name}</span>
                <span className="block text-sm text-muted-foreground">{info.goal}</span>
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-foreground bg-foreground text-background" : "border-border"
                )}
                aria-hidden
              >
                {selected && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>

            {selected && (
              <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3">
                <p className="text-sm">{info.forWho}</p>
                <p className="text-sm font-semibold">{info.progress}</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cosa guarda l&apos;app</p>
                  <ul className="mt-2 space-y-2">
                    {info.indicators.map((indicator) => (
                      <li key={indicator.name} className="flex gap-2.5 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-500" aria-hidden />
                        <span>
                          <span className="font-semibold">{indicator.name}</span>
                          <span className="text-muted-foreground"> · {indicator.explain}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Salva lo stile scelto; lancia un errore se il server non risponde */
export async function saveTrainingStyle(style: TrainingStyle) {
  const res = await fetch("/api/user/training-style", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ style }),
  });
  if (!res.ok) throw new Error("Stile non salvato");
}
