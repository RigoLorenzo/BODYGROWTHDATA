import { differenceInCalendarDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { periodWindow, type Period } from "@/lib/insights";

/** Con cosa si confronta il periodo scelto, detto in parole */
export interface CompareContext {
  /** "rispetto a ottobre, allo stesso giorno" */
  against: string;
  /** il periodo è appena iniziato: il confronto non direbbe ancora nulla */
  early: boolean;
  /** periodo in corso, nella prima metà: un calo non è ancora un calo (niente rosso) */
  settling: boolean;
  /** "La settimana", "Il mese", "L'anno" */
  name: string;
}

/** Giorni da cui un periodo in corso inizia a essere confrontabile */
const MIN_DAYS: Record<Exclude<Period, "all">, number> = { week: 1, month: 3, year: 14 };
const NAME: Record<Exclude<Period, "all">, string> = { week: "La settimana", month: "Il mese", year: "L'anno" };

/** "a ottobre", ma "ad agosto" e "ad aprile" */
const withPreposition = (month: string) => `${month.startsWith("a") ? "ad" : "a"} ${month}`;

export function compareContext(period: Period, anchor: Date, now: Date): CompareContext | null {
  if (period === "all") return null;
  const span = periodWindow(period, anchor, now);
  const previous = span.prevFrom!;
  const target =
    period === "week"
      ? span.isCurrent
        ? "alla settimana scorsa"
        : "alla settimana prima"
      : period === "month"
        ? withPreposition(format(previous, "MMMM", { locale: it }))
        : `al ${format(previous, "yyyy")}`;
  const sameTime = span.isCurrent ? (period === "year" ? ", alla stessa data" : ", allo stesso giorno") : "";
  const elapsed = span.isCurrent ? (now.getTime() - span.from!.getTime()) / (span.to!.getTime() - span.from!.getTime()) : 1;
  return {
    against: `rispetto ${target}${sameTime}`,
    early: span.isCurrent && differenceInCalendarDays(now, span.from!) < MIN_DAYS[period],
    settling: elapsed < 0.5,
    name: NAME[period],
  };
}

/** Come mostrare il confronto: null = non mostrarlo */
export type DiffTone = "good" | "bad" | "soft" | "same";

/**
 * Regola unica dei confronti fra periodi:
 * - senza dati nel periodo prima non si confronta;
 * - per le metriche in cui meno è meglio (il passo) senza dati adesso non si
 *   confronta: "nessuna corsa" varrebbe 0, cioè un passo velocissimo;
 * - nella prima metà di un periodo in corso un peggioramento è grigio, non
 *   rosso: il periodo non è finito e il rosso scoraggia.
 */
export function diffTone(
  value: number,
  before: number,
  { lowerIsBetter = false, settling = false }: { lowerIsBetter?: boolean; settling?: boolean } = {}
): DiffTone | null {
  if (!(before > 0)) return null;
  if (lowerIsBetter && !(value > 0)) return null;
  const diff = value - before;
  if (Math.abs(diff) < 1e-9) return "same";
  const better = diff > 0 !== lowerIsBetter;
  if (better) return "good";
  return settling ? "soft" : "bad";
}
