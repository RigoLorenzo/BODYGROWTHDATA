"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Brain, ChevronRight, Droplet, Footprints, Gauge, HeartPulse, type LucideIcon } from "lucide-react";
import { useActivity } from "@/components/analytics/use-activity";
import { Section, Stat } from "@/components/analytics/ui";
import { cn } from "@/lib/utils";
import {
  STEPS_GOAL,
  formatMinutes,
  mainSleeps,
  readiness,
  restingTrend,
  sleepByTraining,
  sleepTrainingFindings,
  stepsSummary,
  type Readiness,
} from "@/lib/wellness/insights";
import type { WellnessResponse } from "@/lib/wellness/types";
import { StageBar, StageLegend } from "./charts";
import { FindingList } from "./finding-list";
import { heartDetail, stressLabel } from "./format";
import { timeLabel } from "./queries";

const TONE: Record<Readiness["tone"], string> = {
  good: "text-lime-400 dark:text-lime-600",
  neutral: "text-background",
  warn: "text-amber-300 dark:text-amber-600",
  bad: "text-red-300 dark:text-red-600",
};

/** Il numero del giorno: quanto sei pronto ad allenarti */
function ReadinessHero({ value }: { value: Readiness }) {
  return (
    <section className="rounded-3xl bg-foreground p-5 text-background">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-background/70">
        <Gauge className="h-4 w-4" /> Prontezza di oggi
      </div>
      <div className="mt-2 flex items-end gap-3">
        <span className="font-display text-6xl font-bold tabular-nums leading-none">{value.score}</span>
        <span className={cn("pb-1 text-lg font-semibold", TONE[value.tone])}>{value.label}</span>
      </div>
      <ul className="mt-5 space-y-3">
        {value.factors.map((f) => (
          <li key={f.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{f.label}</span>
              <span className="text-xs text-background/70">{f.detail}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background/15">
              <div className="h-full rounded-full bg-background" style={{ width: `${f.score}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-background/60">Sonno della notte, FC a riposo rispetto alla tua norma e carico degli ultimi 7 giorni.</p>
    </section>
  );
}

export function OverviewTab({ data }: { data: WellnessResponse }) {
  const { data: activity = [] } = useActivity();
  const view = useMemo(() => {
    const now = new Date();
    const nights = mainSleeps(data.sleeps);
    const today = format(now, "yyyy-MM-dd");
    return {
      ready: readiness(data.sleeps, data.days, activity, now),
      lastNight: nights.at(-1) ?? null,
      heart: restingTrend(data.days),
      steps: stepsSummary(data.days, now),
      todayDay: data.days.find((d) => d.date === today) ?? data.days.at(-1) ?? null,
      findings: sleepTrainingFindings(sleepByTraining(data.sleeps, activity, data.days)),
    };
  }, [data, activity]);
  const { ready, lastNight, heart, steps, todayDay, findings } = view;

  return (
    <div className="space-y-5">
      {ready && <ReadinessHero value={ready} />}

      {lastNight && (
        <Section
          title="Ultima notte"
          hint={`${timeLabel(lastNight.startAt)} → ${timeLabel(lastNight.endAt)}`}
          action={
            <Link href="?area=benessere&tab=sonno" className="flex items-center text-xs font-medium text-muted-foreground">
              Sonno <ChevronRight className="h-4 w-4" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Dormito" value={formatMinutes(lastNight.asleep)} />
            <Stat label="Punteggio" value={lastNight.score ?? "—"} />
            <Stat label="FC notte" value={lastNight.avgHr ?? "—"} unit={lastNight.avgHr ? "bpm" : undefined} />
          </div>
          <div className="mt-4 space-y-2">
            <StageBar
              parts={[
                { stage: "deep", minutes: lastNight.deep },
                { stage: "light", minutes: lastNight.light },
                { stage: "rem", minutes: lastNight.rem },
                { stage: "awake", minutes: lastNight.awake },
              ]}
            />
            <StageLegend />
          </div>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={HeartPulse} label="FC a riposo" href="battiti">
          <Stat label="" value={heart.latest ?? "—"} unit={heart.latest ? "bpm" : undefined} detail={heartDetail(heart.delta)} />
        </Tile>
        <Tile icon={Footprints} label="Passi oggi" href="attivita">
          <Stat
            label=""
            value={steps.today?.toLocaleString("it-IT") ?? "—"}
            detail={steps.today != null ? `${Math.round((steps.today / STEPS_GOAL) * 100)}% dell'obiettivo` : undefined}
          />
        </Tile>
        <Tile icon={Brain} label="Stress medio" href="vitali">
          <Stat label="" value={todayDay?.stressAvg ?? "—"} detail={todayDay?.stressAvg != null ? stressLabel(todayDay.stressAvg) : undefined} />
        </Tile>
        <Tile icon={Droplet} label="SpO₂" href="vitali">
          <Stat label="" value={todayDay?.spo2Avg != null ? Math.round(todayDay.spo2Avg) : "—"} unit={todayDay?.spo2Avg != null ? "%" : undefined} detail={todayDay?.spo2Min != null ? `minimo ${todayDay.spo2Min}%` : undefined} />
        </Tile>
      </div>

      {findings.length > 0 && (
        <Section title="Sonno e allenamento" hint="Le notti dopo palestra e corsa, confrontate con quelle dopo il riposo">
          <FindingList findings={findings.slice(0, 4)} />
        </Section>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, href, children }: { icon: LucideIcon; label: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={`?area=benessere&tab=${href}`} className="rounded-3xl border border-border/60 bg-card p-4 active:bg-muted/40">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {children}
    </Link>
  );
}
