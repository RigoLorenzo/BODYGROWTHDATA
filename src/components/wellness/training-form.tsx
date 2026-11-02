"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Delta } from "@/components/analytics/delta";
import { formatDelta } from "@/components/analytics/format";
import { Section } from "@/components/analytics/ui";
import { useRunStats } from "@/components/run/queries";
import type { FormTone, RunStats } from "@/components/run/types";
import { cn } from "@/lib/utils";

/**
 * Forma di allenamento (fitness, fatica e forma dal carico delle corse):
 * quanto sei fresco o stanco oggi. Sta in Benessere perché parla di
 * recupero, non di risultati.
 */

/** Zone della forma, da sinistra (stanco) a destra (fresco): le stesse soglie del server */
const ZONES: { tone: FormTone; label: string; from: number; to: number; className: string }[] = [
  { tone: "overreach", label: "Stanco", from: -40, to: -30, className: "bg-red-500" },
  { tone: "tired", label: "In carico", from: -30, to: -10, className: "bg-amber-400" },
  { tone: "neutral", label: "Equilibrato", from: -10, to: 5, className: "bg-muted-foreground/40" },
  { tone: "fresh", label: "Fresco", from: 5, to: 20, className: "bg-lime-500" },
];
const MIN = ZONES[0].from;
const MAX = ZONES.at(-1)!.to;
const position = (form: number) => ((Math.min(MAX, Math.max(MIN, form)) - MIN) / (MAX - MIN)) * 100;

const TONE_TEXT: Record<FormTone, string> = {
  fresh: "text-lime-700 dark:text-lime-400",
  neutral: "text-foreground",
  tired: "text-amber-600 dark:text-amber-400",
  overreach: "text-red-600 dark:text-red-400",
};

/** La scala a zone con il segno di oggi: si legge senza conoscere i numeri */
function FormGauge({ form }: { form: number }) {
  return (
    <div>
      <div className="relative pt-3">
        <span
          className="absolute top-0 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-foreground"
          style={{ left: `${position(form)}%` }}
          aria-hidden
        />
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {ZONES.map((z) => (
            <span key={z.tone} className={z.className} style={{ flexGrow: z.to - z.from }} />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex text-[10px] text-muted-foreground" aria-hidden>
        {ZONES.map((z) => (
          <span key={z.tone} className="min-w-0 truncate text-center" style={{ flexGrow: z.to - z.from, flexBasis: 0 }}>
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const W = 300;
const H = 64;

/** La fitness negli ultimi 90 giorni: una linea sola, con l'area sotto */
function FitnessTrend({ series }: { series: RunStats["fitness"]["series"] }) {
  const values = series.map((p) => p.fitness);
  const max = Math.max(1, ...values) * 1.1;
  const step = W / Math.max(1, values.length - 1);
  const line = values.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(H - (v / max) * H).toFixed(1)}`).join("");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
        <path d={`${line}L${W} ${H}L0 ${H}Z`} className="fill-sky-500/15" />
        <path d={line} fill="none" className="stroke-sky-500" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground" aria-hidden>
        <span>90 giorni fa</span>
        <span>oggi</span>
      </div>
    </div>
  );
}

export function TrainingFormCard() {
  const { data: stats } = useRunStats();
  const fitness = stats?.fitness;
  if (!stats?.allTime.runs || !fitness?.today || !fitness.label) return null;

  const { today, label, series } = fitness;
  // "Fresco: buon momento per spingere" → stato e consiglio
  const [status, advice] = label.label.split(":").map((s) => s.trim());
  const monthAgo = series.at(-31)?.fitness;

  return (
    <Section
      title="Forma"
      hint="Dal carico delle tue corse"
      action={
        <Link href="/run" className="-mr-2 flex h-9 shrink-0 items-center gap-0.5 px-2 text-xs font-medium text-muted-foreground active:text-foreground">
          Corsa <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <p className={cn("font-display text-3xl font-bold uppercase leading-none", TONE_TEXT[label.tone])}>{status}</p>
      {advice && <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{advice}</p>}

      <div className="mt-4">
        <FormGauge form={today.form} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fitness</p>
          <p className="font-display text-2xl font-bold tabular-nums leading-tight text-sky-600 dark:text-sky-400">{Math.round(today.fitness)}</p>
          <p className="text-xs text-muted-foreground">
            {monthAgo != null && monthAgo > 0 ? (
              <>
                <Delta value={formatDelta(today.fitness, monthAgo)} /> in 30 giorni
              </>
            ) : (
              "costruita in 6 settimane"
            )}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fatica</p>
          <p className="font-display text-2xl font-bold tabular-nums leading-tight">{Math.round(today.fatigue)}</p>
          <p className="text-xs text-muted-foreground">ultimi 7 giorni</p>
        </div>
      </div>

      <div className="mt-4">
        <FitnessTrend series={series} />
      </div>
    </Section>
  );
}
