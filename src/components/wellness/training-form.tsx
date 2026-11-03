"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Section } from "@/components/analytics/ui";
import { useRunStats } from "@/components/run/queries";
import type { FormTone, RunStats } from "@/components/run/types";
import { cn } from "@/lib/utils";
import { RUN_HOME } from "@/lib/routes";

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

/** Come sta andando la fitness rispetto a un mese fa, in parole */
function buildTrend(now: number, monthAgo: number | undefined) {
  if (monthAgo == null || monthAgo <= 0) return { text: "in costruzione", className: "text-foreground" };
  const change = (now - monthAgo) / monthAgo;
  if (change > 0.05) return { text: "in crescita", className: "text-lime-700 dark:text-lime-400" };
  if (change < -0.05) return { text: "in calo", className: "text-red-600 dark:text-red-400" };
  return { text: "stabile", className: "text-foreground" };
}

/** Fatica rispetto alla fitness: quanto pesa l'ultima settimana su quello che reggi di solito */
function tirednessLevel(fatigue: number, fitness: number) {
  const ratio = fitness > 0 ? fatigue / fitness : fatigue > 0 ? 2 : 0;
  if (ratio > 1.3) return { text: "alta", className: "text-amber-600 dark:text-amber-400" };
  if (ratio < 0.8) return { text: "bassa", className: "text-lime-700 dark:text-lime-400" };
  return { text: "nella norma", className: "text-foreground" };
}

export function TrainingFormCard() {
  const { data: stats } = useRunStats();
  const fitness = stats?.fitness;
  if (!stats?.allTime.runs || !fitness?.today || !fitness.label) return null;

  const { today, label, series } = fitness;
  // "Fresco: buon momento per spingere" → stato e consiglio
  const [status, advice] = label.label.split(":").map((s) => s.trim());
  const monthAgo = series.at(-31)?.fitness;
  const build = buildTrend(today.fitness, monthAgo);
  const tiredness = tirednessLevel(today.fatigue, today.fitness);

  return (
    <Section
      title="Forma"
      hint="Dal carico delle tue corse"
      action={
        <Link href={RUN_HOME} className="-mr-2 flex h-9 shrink-0 items-center gap-0.5 px-2 text-xs font-medium text-muted-foreground active:text-foreground">
          Corsa <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <p className={cn("font-display text-3xl font-bold uppercase leading-none", TONE_TEXT[label.tone])}>{status}</p>
      {advice && <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{advice}</p>}

      <div className="mt-4">
        <FormGauge form={today.form} />
      </div>

      {/* Niente numeri senza unità: due letture in parole */}
      <dl className="mt-5 space-y-3 border-t border-border/60 pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Allenamento accumulato</dt>
          <dd className={cn("font-semibold", build.className)}>{build.text}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Stanchezza degli ultimi giorni</dt>
          <dd className={cn("font-semibold", tiredness.className)}>{tiredness.text}</dd>
        </div>
      </dl>

      <p className="mt-5 text-xs font-medium text-muted-foreground">Il tuo livello di allenamento negli ultimi 3 mesi</p>
      <div className="mt-2">
        <FitnessTrend series={series} />
      </div>
    </Section>
  );
}
