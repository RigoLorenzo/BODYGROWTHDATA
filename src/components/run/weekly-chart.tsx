"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunStats } from "./types";

interface Props {
  weekly: RunStats["weekly"];
  goalKm: number | null;
}

/** Settimane della media mobile */
const AVG_WEEKS = 4;

const km1 = (km: number) => km.toFixed(1).replace(".", ",");

/** Massimo dell'asse arrotondato a 5/10 km, così le etichette sono numeri tondi */
function niceMax(value: number) {
  const step = value > 40 ? 10 : 5;
  return Math.max(step, Math.ceil(value / step) * step);
}

/** "6–12 ott" oppure "29 set – 5 ott" */
function weekRange(weekStart: string) {
  const start = new Date(weekStart);
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${format(start, "d", { locale: it })}–${format(end, "d MMM", { locale: it })}`
    : `${format(start, "d MMM", { locale: it })} – ${format(end, "d MMM", { locale: it })}`;
}

function useWeeklySeries(weekly: Props["weekly"]) {
  return useMemo(
    () =>
      weekly.map((w, i) => {
        const km = w.distance / 1000;
        const span = weekly.slice(Math.max(0, i - AVG_WEEKS + 1), i + 1);
        const avg = span.length === AVG_WEEKS ? span.reduce((sum, x) => sum + x.distance, 0) / 1000 / AVG_WEEKS : null;
        const prev = i > 0 ? weekly[i - 1].distance / 1000 : null;
        return { weekStart: w.weekStart, runs: w.runs, km, avg, delta: prev == null ? null : km - prev, prev };
      }),
    [weekly]
  );
}

type Point = ReturnType<typeof useWeeklySeries>[number];

function Delta({ point }: { point: Point }) {
  if (point.delta == null) return null;
  const pct = point.prev ? Math.round((point.delta / point.prev) * 100) : null;
  const Icon = Math.abs(point.delta) < 0.05 ? Minus : point.delta > 0 ? ArrowUpRight : ArrowDownRight;
  const sign = point.delta > 0 ? "+" : point.delta < 0 ? "−" : "";
  return (
    <span className="inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums">
      <Icon
        className={cn(
          "h-4 w-4",
          point.delta > 0.05 ? "text-lime-600 dark:text-lime-400" : point.delta < -0.05 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}
        aria-hidden
      />
      {sign}
      {km1(Math.abs(point.delta))} km
      {pct != null && Number.isFinite(pct) && <span className="font-medium text-muted-foreground">({sign}{Math.abs(pct)}%)</span>}
    </span>
  );
}

/** Riquadro sopra il grafico: fa da tooltip per la settimana toccata (di default quella corrente) */
function Readout({ point, isCurrent }: { point: Point; isCurrent: boolean }) {
  return (
    <div className="mb-3 min-h-[4.5rem]" aria-live="polite">
      <p className="text-xs font-medium text-muted-foreground">
        {isCurrent ? "Questa settimana" : weekRange(point.weekStart)} · {point.runs} {point.runs === 1 ? "corsa" : "corse"}
      </p>
      <p className="font-display text-3xl font-bold leading-tight tabular-nums">
        {km1(point.km)}
        <span className="ml-1 text-base font-semibold text-muted-foreground">km</span>
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {point.delta != null && (
          <span className="inline-flex items-center gap-1">
            <Delta point={point} /> vs settimana prima
          </span>
        )}
        {point.avg != null && (
          <span className="tabular-nums">
            Media {AVG_WEEKS} sett. <span className="font-semibold text-foreground">{km1(point.avg)} km</span>
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Km per settimana (ultime 12): barre con la settimana corrente evidenziata,
 * media mobile a 4 settimane, obiettivo tratteggiato. Tocca o passa sopra una
 * barra per vederne i dettagli; la tabella nascosta serve agli screen reader.
 */
export function WeeklyChart({ weekly, goalKm }: Props) {
  const series = useWeeklySeries(weekly);
  const last = series.length - 1;
  const [selected, setSelected] = useState(last);
  const [pinned, setPinned] = useState(last);

  if (!series.length) return null;

  const active = series[Math.min(selected, last)];
  const goal = goalKm ?? 0;
  const max = niceMax(Math.max(goal, ...series.map((p) => Math.max(p.km, p.avg ?? 0)), 1));
  const y = (km: number) => 100 - (km / max) * 100;
  const n = series.length;
  const avgPath = series
    .map((p, i) => (p.avg == null ? null : `${((i + 0.5) / n) * 100},${y(p.avg)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <Readout point={active} isCurrent={selected === last} />

      <div className="flex gap-2">
        {/* Asse y: 0, metà, massimo */}
        <div className="relative h-36 w-6 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground" aria-hidden>
          {[max, max / 2, 0].map((v) => (
            <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(v)}%` }}>
              {String(v).replace(".", ",")}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-36" onPointerLeave={() => setSelected(pinned)}>
            {/* Griglia leggera */}
            {[max, max / 2].map((v) => (
              <div
                key={v}
                className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                style={{ top: `${y(v)}%` }}
                aria-hidden
              />
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />

            {goal > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/50"
                style={{ top: `${y(goal)}%` }}
                aria-hidden
              />
            )}

            <div className="absolute inset-0 flex items-end" role="group" aria-label="Km per settimana">
              {series.map((p, i) => {
                const isCurrent = i === last;
                const isSelected = i === selected;
                return (
                  <button
                    key={p.weekStart}
                    type="button"
                    className="group relative flex h-full flex-1 flex-col justify-end px-[3px] outline-none touch-manipulation"
                    aria-label={`${isCurrent ? "Questa settimana" : weekRange(p.weekStart)}: ${km1(p.km)} km, ${p.runs} corse`}
                    aria-pressed={isSelected}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setSelected(i)}
                    onFocus={() => setSelected(i)}
                    onClick={() => {
                      setSelected(i);
                      setPinned(i);
                    }}
                  >
                    {isSelected && p.km > 0 && (
                      <span className="pointer-events-none absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums" style={{ bottom: `calc(${(p.km / max) * 100}% + 2px)` }}>
                        {km1(p.km)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "block w-full rounded-t-[4px] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                        isCurrent ? "bg-lime-500" : isSelected ? "bg-foreground/70" : "bg-foreground/25",
                        p.km === 0 && "bg-muted"
                      )}
                      style={{ height: p.km > 0 ? `${Math.max(3, (p.km / max) * 100)}%` : "3px" }}
                    />
                  </button>
                );
              })}
            </div>

            {avgPath && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                <polyline
                  points={avgPath}
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>

          {/* Asse x: una data ogni 3 settimane, allineata alla corrente */}
          <div className="mt-1.5 flex text-[10px] text-muted-foreground" aria-hidden>
            {series.map((p, i) => (
              <span key={p.weekStart} className={cn("flex-1 text-center tabular-nums", i === last && "font-semibold text-foreground")}>
                {i === last ? "ora" : (last - i) % 3 === 0 ? format(new Date(p.weekStart), "d/M", { locale: it }) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/25" /> km
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-lime-500" /> settimana in corso
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-foreground" /> media {AVG_WEEKS} sett.
        </span>
        {goal > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-foreground/50" /> obiettivo{" "}
            {String(goal).replace(".", ",")} km
          </span>
        )}
      </div>

      <table className="sr-only">
        <caption>Km per settimana, ultime {n} settimane</caption>
        <thead>
          <tr>
            <th scope="col">Settimana</th>
            <th scope="col">Km</th>
            <th scope="col">Corse</th>
            <th scope="col">Media {AVG_WEEKS} settimane</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.weekStart}>
              <th scope="row">{weekRange(p.weekStart)}</th>
              <td>{km1(p.km)}</td>
              <td>{p.runs}</td>
              <td>{p.avg == null ? "–" : km1(p.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
