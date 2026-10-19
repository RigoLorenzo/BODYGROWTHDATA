"use client";

import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { HourlyHr, SleepSegment, SleepStage } from "@/lib/wellness/types";

/**
 * Grafici del benessere in HTML/SVG, senza librerie: linee sottili, una sola
 * scala, etichette solo agli estremi e dettaglio al tocco.
 */

// Rampa ordinale di un solo tono (validata in chiaro e in scuro): più profondo = più contrasto
export const STAGE_STYLE: Record<SleepStage, { label: string; className: string }> = {
  deep: { label: "Profondo", className: "bg-indigo-900 dark:bg-indigo-200" },
  light: { label: "Leggero", className: "bg-indigo-600 dark:bg-indigo-400" },
  rem: { label: "REM", className: "bg-indigo-400 dark:bg-indigo-600" },
  awake: { label: "Sveglio", className: "bg-muted-foreground/35" },
};
const STAGE_ORDER: SleepStage[] = ["awake", "rem", "light", "deep"];

export function StageLegend({ stages = ["deep", "light", "rem", "awake"] }: { stages?: SleepStage[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {stages.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-sm", STAGE_STYLE[s].className)} /> {STAGE_STYLE[s].label}
        </span>
      ))}
    </div>
  );
}

/** Colori delle serie (classi complete, così Tailwind le genera) */
const TONES = {
  ink: { line: "stroke-foreground", dot: "bg-foreground" },
  rose: { line: "stroke-rose-500", dot: "bg-rose-500" },
  indigo: { line: "stroke-indigo-500", dot: "bg-indigo-500" },
  amber: { line: "stroke-amber-500", dot: "bg-amber-500" },
  sky: { line: "stroke-sky-500", dot: "bg-sky-500" },
} as const;

export interface LinePoint {
  key: string;
  label: string;
  value: number | null;
}

const W = 300;

/** Linea nel tempo con riferimento opzionale (la tua norma) e cursore al tocco */
export function TrendLine({
  points,
  unit,
  reference,
  referenceLabel = "norma",
  tone = "rose",
  height = 112,
  digits = 0,
}: {
  points: LinePoint[];
  unit: string;
  reference?: number | null;
  referenceLabel?: string;
  tone?: keyof typeof TONES;
  height?: number;
  digits?: number;
}) {
  const color = TONES[tone];
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (values.length < 2) return <p className="py-6 text-center text-sm text-muted-foreground">Servono più giorni di dati</p>;

  const lo = Math.min(...values, reference ?? Infinity);
  const hi = Math.max(...values, reference ?? -Infinity);
  const pad = Math.max(1, (hi - lo) * 0.15);
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => height - ((v - min) / (max - min)) * height;
  const fmt = (v: number) => v.toFixed(digits).replace(".", ",");

  // Tratti separati dove manca il dato
  let d = "";
  points.forEach((p, i) => {
    if (p.value == null) return;
    const prev = points[i - 1];
    d += `${!prev || prev.value == null ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`;
  });

  const lastIndex = points.reduce((last, p, i) => (p.value != null ? i : last), -1);
  const shown = active ?? lastIndex;
  const point = points[shown];

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (points.length - 1));
    const clamped = Math.min(points.length - 1, Math.max(0, i));
    setActive(points[clamped].value == null ? null : clamped);
  };

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          {point?.label}:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {point?.value != null ? `${fmt(point.value)} ${unit}` : "—"}
          </span>
        </span>
        {reference != null && (
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 bg-muted-foreground" /> {referenceLabel} {fmt(reference)}
          </span>
        )}
      </div>
      <div
        className="relative touch-pan-y"
        style={{ height }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        role="img"
        aria-label={`Andamento in ${unit}: da ${fmt(values[0])} a ${fmt(values[values.length - 1])}`}
      >
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {reference != null && (
            <line x1={0} x2={W} y1={y(reference)} y2={y(reference)} className="stroke-muted-foreground/50" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
          <path d={d} fill="none" className={color.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {point?.value != null && (
            <line x1={x(shown)} x2={x(shown)} y1={0} y2={height} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {point?.value != null && (
          <span
            className={cn("pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card", color.dot)}
            style={{ left: `${(x(shown) / W) * 100}%`, top: y(point.value) }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/** Frequenza cardiaca ora per ora: barra dal minimo al massimo, tacca sulla media */
export function HourlyHeartRate({ hours }: { hours: HourlyHr[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (!hours.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nessun battito registrato</p>;
  const byHour = new Map(hours.map((h) => [h.h, h]));
  const lo = Math.min(...hours.map((h) => h.min)) - 5;
  const hi = Math.max(...hours.map((h) => h.max)) + 5;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const shown = active != null ? byHour.get(active) : null;

  return (
    <div>
      <p className="mb-2 h-4 text-xs text-muted-foreground">
        {shown ? (
          <>
            {String(shown.h).padStart(2, "0")}:00 ·{" "}
            <span className="font-semibold tabular-nums text-foreground">
              media {shown.avg} · min {shown.min} · max {shown.max} bpm
            </span>
          </>
        ) : (
          "Tocca un'ora per i dettagli"
        )}
      </p>
      <div className="flex h-32 items-stretch gap-[2px]" onPointerLeave={() => setActive(null)}>
        {Array.from({ length: 24 }, (_, h) => {
          const hr = byHour.get(h);
          return (
            <button
              key={h}
              type="button"
              aria-label={hr ? `${h}:00, media ${hr.avg} bpm, da ${hr.min} a ${hr.max}` : `${h}:00, nessun dato`}
              onPointerEnter={() => setActive(h)}
              onClick={() => setActive(h)}
              className="relative min-w-0 flex-1"
            >
              {hr && (
                <>
                  <span
                    className={cn("absolute inset-x-0 rounded-full", active === h ? "bg-rose-500/45" : "bg-rose-500/25")}
                    style={{ bottom: `${pct(hr.min)}%`, top: `${100 - pct(hr.max)}%` }}
                  />
                  <span className="absolute inset-x-0 h-[3px] -translate-y-1/2 rounded-full bg-rose-500" style={{ top: `${100 - pct(hr.avg)}%` }} />
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        {["00", "06", "12", "18", "23"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

const clock = (epoch: number) => format(new Date(epoch * 1000), "HH:mm", { locale: it });

/** Ipnogramma: una riga per fase, dal più leggero (sveglio) al più profondo */
export function Hypnogram({ stages, start, end }: { stages: SleepSegment[]; start: number; end: number }) {
  const span = Math.max(1, end - start);
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex w-16 shrink-0 flex-col justify-between py-0.5 text-[10px] text-muted-foreground">
          {STAGE_ORDER.map((s) => (
            <span key={s} className="h-5 leading-5">
              {STAGE_STYLE[s].label}
            </span>
          ))}
        </div>
        <div className="relative h-[92px] flex-1 rounded-lg bg-muted/40">
          {stages.map((seg, i) => {
            const row = STAGE_ORDER.indexOf(seg.stage);
            return (
              <span
                key={i}
                title={`${STAGE_STYLE[seg.stage].label} ${clock(seg.start)}–${clock(seg.end)}`}
                className={cn("absolute h-5 rounded-[3px]", STAGE_STYLE[seg.stage].className)}
                style={{
                  left: `${((seg.start - start) / span) * 100}%`,
                  width: `max(2px, ${((seg.end - seg.start) / span) * 100}%)`,
                  top: row * 24,
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="ml-[72px] mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{clock(start)}</span>
        <span>{clock(end)}</span>
      </div>
    </div>
  );
}

/** Ripartizione delle fasi in una barra orizzontale */
export function StageBar({ parts }: { parts: { stage: SleepStage; minutes: number | null }[] }) {
  const known = parts.filter((p): p is { stage: SleepStage; minutes: number } => !!p.minutes);
  const total = known.reduce((s, p) => s + p.minutes, 0);
  if (!total) return null;
  return (
    <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
      {known.map((p) => (
        <span
          key={p.stage}
          title={`${STAGE_STYLE[p.stage].label}: ${p.minutes} min`}
          className={STAGE_STYLE[p.stage].className}
          style={{ flexGrow: p.minutes }}
        />
      ))}
    </div>
  );
}

export interface NightBar {
  key: string;
  label: string;
  deep: number;
  light: number;
  rem: number;
  /** minuti di sonno senza fasi note */
  other: number;
  caption: string;
}

/** Notti impilate per fase, con la linea del sonno consigliato */
export function NightBars({ nights, target, labelEvery = 5 }: { nights: NightBar[]; target: number; labelEvery?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(target * 1.15, ...nights.map((n) => n.deep + n.light + n.rem + n.other));
  const last = nights.length - 1;
  const shown = active != null ? nights[active] : null;
  return (
    <div>
      <p className="mb-2 h-4 text-xs text-muted-foreground">
        {shown ? (
          <>
            {shown.label}: <span className="font-semibold text-foreground">{shown.caption}</span>
          </>
        ) : (
          "Tocca una notte per i dettagli"
        )}
      </p>
      <div className="relative flex h-36 items-end gap-[2px]" onPointerLeave={() => setActive(null)}>
        <span className="pointer-events-none absolute inset-x-0 h-px bg-muted-foreground/50" style={{ bottom: `${(target / max) * 100}%` }} />
        {nights.map((n, i) => {
          const total = n.deep + n.light + n.rem + n.other;
          return (
            <button
              key={n.key}
              type="button"
              aria-label={`${n.label}: ${n.caption}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span
                className={cn("flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]", active != null && active !== i && "opacity-60")}
                style={{ height: `${(total / max) * 100}%` }}
              >
                {!!n.deep && <span className={STAGE_STYLE.deep.className} style={{ flexGrow: n.deep }} />}
                {!!n.light && <span className={STAGE_STYLE.light.className} style={{ flexGrow: n.light }} />}
                {!!n.rem && <span className={STAGE_STYLE.rem.className} style={{ flexGrow: n.rem }} />}
                {!!n.other && <span className="bg-indigo-500/50" style={{ flexGrow: n.other }} />}
              </span>
              {!total && <span className="h-1 w-full rounded-full bg-muted" />}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-muted-foreground">
        {nights.map((n, i) => (
          <span key={n.key} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {(last - i) % labelEvery === 0 ? n.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barre semplici giornaliere (passi, stress) con soglia opzionale */
export function DayBars({
  bars,
  goal,
  barClassName = "bg-foreground/60",
  highlightClassName = "bg-foreground",
  labelEvery = 5,
}: {
  bars: { key: string; label: string; value: number | null; caption: string; highlight?: boolean }[];
  goal?: number;
  barClassName?: string;
  highlightClassName?: string;
  labelEvery?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(goal ? goal * 1.1 : 1, ...bars.map((b) => b.value ?? 0));
  const last = bars.length - 1;
  const shown = active != null ? bars[active] : null;
  return (
    <div>
      <p className="mb-2 h-4 text-xs text-muted-foreground">
        {shown ? (
          <>
            {shown.label}: <span className="font-semibold text-foreground">{shown.caption}</span>
          </>
        ) : (
          "Tocca un giorno per i dettagli"
        )}
      </p>
      <div className="relative flex h-32 items-end gap-[2px]" onPointerLeave={() => setActive(null)}>
        {goal && <span className="pointer-events-none absolute inset-x-0 h-px bg-muted-foreground/50" style={{ bottom: `${(goal / max) * 100}%` }} />}
        {bars.map((b, i) => (
          <button
            key={b.key}
            type="button"
            aria-label={`${b.label}: ${b.caption}`}
            onPointerEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            {b.value ? (
              <span
                className={cn("w-full rounded-t-[4px]", b.highlight ? highlightClassName : barClassName, active != null && active !== i && "opacity-60")}
                style={{ height: `${(b.value / max) * 100}%` }}
              />
            ) : (
              <span className="h-1 w-full rounded-full bg-muted" />
            )}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-muted-foreground">
        {bars.map((b, i) => (
          <span key={b.key} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {(last - i) % labelEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
