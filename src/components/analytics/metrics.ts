import { formatKm } from "@/lib/run/format";
import { formatVolume } from "@/lib/utils";
import { formatDecimal, formatHours, splitUnit } from "./format";
import type { PeriodMetric } from "./period-metrics";

/* ─── Le metriche di tutte le attività ─── */

export const SESSIONS: PeriodMetric = {
  key: "sessions",
  label: "Allenamenti",
  value: (t) => t.sessions,
  display: (v) => ({ value: String(v) }),
  diff: String,
  parts: (t) => ({ primary: t.gym, secondary: t.runs, tertiary: t.other }),
  caption: (v) => formatDecimal(v),
  unit: "allenamenti",
};

export const TIME: PeriodMetric = {
  key: "time",
  label: "Tempo",
  value: (t) => t.duration,
  display: (v) => ({ value: formatHours(v) }),
  diff: formatHours,
  parts: (t) => ({ primary: t.gymDuration / 3600, secondary: t.runDuration / 3600, tertiary: t.otherDuration / 3600 }),
  caption: (v) => `${formatDecimal(v)}h`,
};

/** Peso sollevato in tonnellate sulle barre: "86t", "6,2t" */
const tons = (v: number) => `${v >= 10 ? Math.round(v) : formatDecimal(v)}t`;

export const LIFTED: PeriodMetric = {
  key: "lifted",
  label: "Peso sollevato",
  value: (t) => t.volume,
  display: (v) => {
    const [value, unit] = splitUnit(formatVolume(v));
    return { value, unit };
  },
  diff: formatVolume,
  parts: (t) => ({ primary: t.volume / 1000 }),
  caption: tons,
};

export const KM: PeriodMetric = {
  key: "km",
  label: "Km corsi",
  value: (t) => t.distance,
  display: (v) => ({ value: formatKm(v), unit: "km" }),
  diff: (m) => `${formatKm(m)} km`,
  parts: (t) => ({ primary: 0, secondary: t.distance / 1000 }),
  caption: (v) => formatDecimal(v, v >= 100 ? 0 : 1),
  unit: "km",
};
