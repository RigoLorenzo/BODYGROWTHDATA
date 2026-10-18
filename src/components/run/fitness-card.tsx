import { cn } from "@/lib/utils";
import type { FormTone, RunStats } from "./types";

const TONE: Record<FormTone, string> = {
  fresh: "text-lime-600 dark:text-lime-400",
  neutral: "text-foreground",
  tired: "text-amber-600 dark:text-amber-400",
  overreach: "text-red-600 dark:text-red-400",
};

const W = 300;
const H = 90;

function path(values: number[], max: number) {
  const step = W / Math.max(1, values.length - 1);
  return values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(H - (v / max) * H).toFixed(1)}`).join("");
}

/** Fitness (42 gg), fatica (7 gg) e forma: il pannello "Fitness e forma" */
export function FitnessCard({ fitness }: { fitness: RunStats["fitness"] }) {
  const { series, today, label } = fitness;
  const max = Math.max(10, ...series.map((p) => Math.max(p.fitness, p.fatigue))) * 1.1;

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Fitness e forma</h2>
        <span className="text-xs text-muted-foreground">90 giorni</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Value label="Fitness" value={today?.fitness} className="text-sky-600 dark:text-sky-400" />
        <Value label="Fatica" value={today?.fatigue} className="text-fuchsia-600 dark:text-fuchsia-400" />
        <Value label="Forma" value={today?.form} className={label ? TONE[label.tone] : undefined} signed />
      </div>
      {label && <p className={cn("mt-1 text-sm font-medium", TONE[label.tone])}>{label.label}</p>}

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-4 h-24 w-full" aria-hidden>
        <path d={path(series.map((p) => p.fatigue), max)} fill="none" className="stroke-fuchsia-500/70" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={path(series.map((p) => p.fitness), max)} fill="none" className="stroke-sky-500" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Calcolato dal carico di ogni corsa (durata × frequenza cardiaca). Imposta FC massima e a riposo per renderlo
        preciso.
      </p>
    </section>
  );
}

function Value({ label, value, className, signed }: { label: string; value?: number; className?: string; signed?: boolean }) {
  const v = Math.round(value ?? 0);
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-display text-2xl font-bold tabular-nums", className)}>{signed && v > 0 ? `+${v}` : v}</p>
    </div>
  );
}
