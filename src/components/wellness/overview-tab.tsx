"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Brain, ChevronRight, Droplet, Footprints, Gauge, HeartPulse, type LucideIcon } from "lucide-react";
import { DEVICE_APP, type DeviceProvider } from "@/components/devices/labels";
import { useActivity } from "@/components/analytics/use-activity";
import { Section, Stat } from "@/components/analytics/ui";
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
import type { SleepJson, WellnessResponse } from "@/lib/wellness/types";
import { StageBar, StageLegend } from "./charts";
import { FindingList } from "./finding-list";
import { QualityStat } from "./quality-stat";
import { ScoreHero } from "./score-hero";
import { heartDetail, stressLabel } from "./format";
import { dayLabel, timeLabel } from "./queries";

const MISSING: Record<Readiness["missing"][number], string> = { sleep: "il sonno di stanotte", heart: "la FC a riposo di oggi" };

/** Senza sonno né FC a riposo recenti il punteggio non si calcola */
function ReadinessPending({
  sleepDate,
  restingDate,
  source,
}: {
  sleepDate: string | null;
  restingDate: string | null;
  source: DeviceProvider | null;
}) {
  const last = [sleepDate && `sonno del ${dayLabel(sleepDate)}`, restingDate && `FC a riposo del ${dayLabel(restingDate)}`].filter(Boolean);
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Gauge className="h-4 w-4" /> Prontezza di oggi
      </div>
      <p className="mt-2 text-sm">In attesa del sonno di stanotte e della FC a riposo dall&apos;orologio.</p>
      {last.length > 0 && <p className="mt-1 text-sm text-muted-foreground">Ultimi arrivati: {last.join(", ")}.</p>}
      <p className="mt-1 text-xs text-muted-foreground">Apri {source ? DEVICE_APP[source] : "l'app dell'orologio"} sul telefono per sincronizzarlo, poi tocca Aggiorna.</p>
    </section>
  );
}

/** Orari della notte, con il giorno se non è quella appena passata */
function nightHint(night: SleepJson, today: string) {
  const hours = `${timeLabel(night.startAt)} → ${timeLabel(night.endAt)}`;
  return night.date === today ? hours : `${format(parseISO(night.date), "EEE d MMM", { locale: it })} · ${hours}`;
}

/** Il numero del giorno: quanto sei pronto ad allenarti */
function ReadinessHero({ value }: { value: Readiness }) {
  const missing = value.missing.length ? ` Manca ${value.missing.map((m) => MISSING[m]).join(" e ")}: il punteggio usa solo il resto.` : "";
  return (
    <ScoreHero
      icon={Gauge}
      title="Prontezza di oggi"
      value={value}
      note={`Sonno della notte, FC a riposo rispetto alla tua norma e carico degli ultimi 7 giorni.${missing}`}
    />
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
      today,
    };
  }, [data, activity]);
  const { ready, lastNight, heart, steps, todayDay, findings, today } = view;

  return (
    <div className="space-y-5">
      {ready ? <ReadinessHero value={ready} /> : data.connected && <ReadinessPending sleepDate={lastNight?.date ?? null} restingDate={heart.latestDate} source={data.source} />}

      {lastNight && (
        <Section
          title="Ultima notte"
          hint={nightHint(lastNight, today)}
          action={
            <Link href="/wellness?tab=sonno" className="flex items-center text-xs font-medium text-muted-foreground">
              Sonno <ChevronRight className="h-4 w-4" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Dormito" value={formatMinutes(lastNight.asleep)} />
            <QualityStat night={lastNight} />
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
    <Link href={`/wellness?tab=${href}`} className="rounded-3xl border border-border/60 bg-card p-4 active:bg-muted/40">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      {children}
    </Link>
  );
}
