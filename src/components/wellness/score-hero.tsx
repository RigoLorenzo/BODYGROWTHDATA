import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreFactor, Tone } from "@/lib/wellness/insights";

const TONE: Record<Tone, string> = {
  good: "text-lime-400 dark:text-lime-600",
  neutral: "text-background",
  warn: "text-amber-300 dark:text-amber-600",
  bad: "text-red-300 dark:text-red-600",
};

/** Punteggio 0-100 in evidenza, con il contributo di ogni fattore */
export function ScoreHero({
  icon: Icon,
  title,
  value,
  note,
}: {
  icon: LucideIcon;
  title: string;
  value: { score: number; label: string; tone: Tone; factors: ScoreFactor<string>[] };
  note?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-foreground p-5 text-background">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-background/70">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="mt-2 flex items-end gap-3">
        <span className="font-display text-6xl font-bold tabular-nums leading-none">{value.score}</span>
        <span className={cn("pb-1 text-lg font-semibold", TONE[value.tone])}>{value.label}</span>
      </div>
      <ul className="mt-5 space-y-3">
        {value.factors.map((f) => (
          <li key={f.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{f.label}</span>
              <span className="text-right text-xs text-background/70">{f.detail}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background/15">
              <div className="h-full rounded-full bg-background" style={{ width: `${f.score}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {note && <p className="mt-4 text-xs text-background/60">{note}</p>}
    </section>
  );
}
