"use client";

import { useCallback, useMemo, useState } from "react";
import { Moon } from "lucide-react";
import { useActivity } from "@/components/analytics/use-activity";
import { formatDecimal } from "@/components/analytics/format";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { cn } from "@/lib/utils";
import {
  SLEEP_NEED_MIN,
  deepShare,
  sleepEfficiency,
  formatMinutes,
  lastDays,
  mainSleeps,
  sleepByTraining,
  sleepRoutine,
  sleepScore,
  sleepTrainingFindings,
  type SleepGroup,
} from "@/lib/wellness/insights";
import type { SleepJson, WellnessResponse } from "@/lib/wellness/types";
import { Hypnogram, NightBars, StageBar, StageLegend } from "./charts";
import { FindingList } from "./finding-list";
import { dayLabel, longDayLabel, nightsByDate, timeLabel } from "./queries";
import { QualityStat } from "./quality-stat";
import { RangeTrend } from "./range-trend";
import { ScoreHero } from "./score-hero";

const pct = (part: number | null, total: number) => (part != null && total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

function NightDetail({ night }: { night: SleepJson }) {
  const start = new Date(night.startAt).getTime() / 1000;
  const end = new Date(night.endAt).getTime() / 1000;
  return (
    <>
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        <Stat label="Dormito" value={formatMinutes(night.asleep)} detail={`${timeLabel(night.startAt)} → ${timeLabel(night.endAt)}`} />
        <QualityStat night={night} />
        <Stat
          label="FC notte"
          value={night.avgHr ?? "—"}
          unit={night.avgHr ? "bpm" : undefined}
          detail={night.minHr ? `min ${night.minHr}${night.maxHr ? ` · max ${night.maxHr}` : ""}` : undefined}
        />
        <Stat
          label="Respiro"
          value={night.respRate != null ? formatDecimal(night.respRate) : "—"}
          unit={night.respRate != null ? "/min" : undefined}
          detail={night.respRate != null ? "atti al minuto" : undefined}
        />
        <Stat label="Risvegli" value={night.awakeCount ?? "—"} detail={night.awake != null ? `${formatMinutes(night.awake)} svegli` : undefined} />
        <Stat label="A letto" value={formatMinutes(inBedMinutes(night))} />
      </div>
      <div className="mt-4">
        {night.stages?.length ? (
          <Hypnogram stages={night.stages} start={start} end={end} />
        ) : (
          <StageBar
            parts={[
              { stage: "deep", minutes: night.deep },
              { stage: "light", minutes: night.light },
              { stage: "rem", minutes: night.rem },
              { stage: "awake", minutes: night.awake },
            ]}
          />
        )}
      </div>
      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["Profondo", night.deep],
            ["Leggero", night.light],
            ["REM", night.rem],
            ["Sveglio", night.awake],
          ] as const
        ).map(([label, minutes]) => (
          <div key={label} className="rounded-xl bg-muted/50 px-1 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{minutes != null ? formatMinutes(minutes) : "—"}</dd>
            <dd className="text-[10px] text-muted-foreground">{label === "Sveglio" ? "" : pct(minutes, night.asleep)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

const inBedMinutes = (n: SleepJson) => (new Date(n.endAt).getTime() - new Date(n.startAt).getTime()) / 60_000;

/** "7h 32m · punteggio 81 · efficienza 93%" per il dettaglio della barra */
function nightCaption(n: SleepJson) {
  const efficiency = sleepEfficiency(n);
  return [formatMinutes(n.asleep), `punteggio ${sleepScore(n).score}`, efficiency != null && `efficienza ${Math.round(efficiency * 100)}%`]
    .filter(Boolean)
    .join(" · ");
}

function TrainingComparison({ groups }: { groups: SleepGroup[] }) {
  const columns = [
    { label: "Sonno", get: (g: SleepGroup) => (g.asleep != null ? formatMinutes(g.asleep) : "—") },
    { label: "Profondo", get: (g: SleepGroup) => (g.deepPct != null ? `${Math.round(g.deepPct)}%` : "—") },
    { label: "FC notte", get: (g: SleepGroup) => (g.sleepHr != null ? `${Math.round(g.sleepHr)}` : "—") },
  ];
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 font-medium">Giorno prima</th>
            {columns.map((c) => (
              <th key={c.label} className="pb-2 text-right font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-t border-border/60">
              <td className="py-2.5">
                {g.short}
                <span className="block text-[11px] text-muted-foreground">{g.nights} notti</span>
              </td>
              {columns.map((c) => (
                <td key={c.label} className="py-2.5 text-right tabular-nums">
                  {c.get(g)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SleepTab({ data }: { data: WellnessResponse }) {
  const { data: activity = [] } = useActivity();
  const nights = useMemo(() => mainSleeps(data.sleeps), [data.sleeps]);
  const [selected, setSelected] = useState<string | null>(null);
  const byDate = useMemo(() => nightsByDate(nights), [nights]);
  const respOf = useCallback((d: string) => byDate.get(d)?.respRate ?? null, [byDate]);
  const asleepOf = useCallback((d: string) => byDate.get(d)?.asleep ?? null, [byDate]);
  const night = byDate.get(selected ?? "") ?? nights.at(-1);

  const month = useMemo(() => {
    return lastDays(30).map((d) => {
      const n = byDate.get(d);
      const staged = n ? (n.deep ?? 0) + (n.light ?? 0) + (n.rem ?? 0) : 0;
      return {
        key: d,
        label: dayLabel(d),
        deep: n?.deep ?? 0,
        light: n?.light ?? 0,
        rem: n?.rem ?? 0,
        other: n ? Math.max(0, n.asleep - staged) : 0,
        caption: n ? nightCaption(n) : "nessun dato",
      };
    });
  }, [byDate]);
  // Ultimi 30 giorni di calendario, come il grafico qui sotto
  const monthStart = lastDays(30)[0];
  const recent = nights.filter((n) => n.date >= monthStart);
  const avgAsleep = recent.length ? recent.reduce((s, n) => s + n.asleep, 0) / recent.length : null;
  const deepValues = recent.map(deepShare).filter((v): v is number => v != null);
  const avgDeep = deepValues.length ? (deepValues.reduce((s, v) => s + v, 0) / deepValues.length) * 100 : null;

  const routine = useMemo(() => sleepRoutine(data.sleeps), [data.sleeps]);
  const groups = useMemo(() => sleepByTraining(data.sleeps, activity, data.days), [data, activity]);
  const findings = useMemo(() => sleepTrainingFindings(groups), [groups]);
  const naps = data.sleeps.filter((s) => s.isNap).slice(-5).reverse();

  if (!night) return <EmptyState>Nessuna notte registrata: dormi con l&apos;orologio al polso per vedere le fasi del sonno.</EmptyState>;

  const isLast = night === nights.at(-1);
  return (
    <div className="space-y-5">
      <ScoreHero
        icon={Moon}
        title={isLast ? "Punteggio sonno" : `Punteggio sonno · ${dayLabel(night.date)}`}
        value={sleepScore(night)}
        note="0 è non aver dormito, 100 un riposo completo. Conta soprattutto la durata (piena da 8 ore), poi efficienza, profondo e REM, continuità."
      />

      <Section title={isLast ? "Ultima notte" : "Notte"} hint={longDayLabel(night.date)}>
        <NightDetail night={night} />
        <StageLegend />
        {nights.length > 1 && (
          <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {nights
              .slice(-7)
              .reverse()
              .map((n) => (
                <button
                  key={n.date}
                  type="button"
                  onClick={() => setSelected(n.date)}
                  aria-pressed={n.date === night.date}
                  className={cn(
                    "h-8 shrink-0 rounded-full px-3 text-xs font-medium",
                    n.date === night.date ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}
                >
                  {dayLabel(n.date)} · {sleepScore(n).score}
                </button>
              ))}
          </div>
        )}
      </Section>

      <Section title="Ultimi 30 giorni" hint={`Linea: ${formatMinutes(SLEEP_NEED_MIN)} consigliate`}>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Media" value={avgAsleep != null ? formatMinutes(avgAsleep) : "—"} />
          <Stat label="Profondo" value={avgDeep != null ? `${Math.round(avgDeep)}%` : "—"} detail="ideale 15-25%" />
          <Stat label="Notti ≥ 7h" value={recent.filter((n) => n.asleep >= 420).length} detail={`su ${recent.length}`} />
        </div>
        <NightBars nights={month} target={SLEEP_NEED_MIN} />
        <div className="mt-3">
          <StageLegend stages={["deep", "light", "rem"]} />
        </div>
      </Section>

      <Section title="Andamento" hint="Ore di sonno per notte">
        <RangeTrend value={asleepOf} unit="min" tone="indigo" format={formatMinutes} reference={SLEEP_NEED_MIN} referenceLabel="consigliate" />
      </Section>

      {nights.some((n) => n.respRate != null) && (
        <Section title="Respirazione nel sonno" hint="Atti al minuto: di solito 12-20, stabili notte dopo notte">
          <RangeTrend value={respOf} unit="/min" tone="sky" digits={1} />
          <p className="mt-3 text-xs text-muted-foreground">
            Un aumento di 1-2 atti sopra la tua media per più notti può anticipare stanchezza, malanni o un recupero incompleto.
          </p>
        </Section>
      )}

      <Section title="Abitudini" hint="Ultime due settimane">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="A letto" value={routine.bedtime ?? "—"} detail="in media" />
          <Stat label="Sveglia" value={routine.wake ?? "—"} detail="in media" />
          <Stat label="Debito 7 gg" value={formatMinutes(routine.debt)} detail={routine.debt > 120 ? "da recuperare" : "sotto controllo"} />
        </div>
        {routine.label && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{routine.label}</span>: orari che variano di circa{" "}
            {Math.round(routine.variation!)} minuti. Orari costanti migliorano il sonno profondo e il recupero.
          </p>
        )}
      </Section>

      {groups.length > 1 && (
        <Section title="Sonno e allenamento" hint="Come dormi in base a cosa hai fatto il giorno prima">
          <TrainingComparison groups={groups} />
          {findings.length > 0 ? (
            <div className="mt-4">
              <FindingList findings={findings} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Servono almeno 3 notti per gruppo per un confronto affidabile.</p>
          )}
        </Section>
      )}

      {naps.length > 0 && (
        <Section title="Pisolini">
          <ul className="space-y-2 text-sm">
            {naps.map((n) => (
              <li key={n.id} className="flex justify-between">
                <span>
                  {dayLabel(n.date)} · {timeLabel(n.startAt)}
                </span>
                <span className="font-medium tabular-nums">{formatMinutes(n.asleep)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
