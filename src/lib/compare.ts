import { differenceInCalendarDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { periodWindow, type Period } from "@/lib/insights";

/** Con cosa si confronta il periodo scelto, detto in parole */
export interface CompareContext {
  /** "rispetto a ottobre, allo stesso giorno" */
  against: string;
  /** il periodo è appena iniziato: il confronto non direbbe ancora nulla */
  early: boolean;
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
  return {
    against: `rispetto ${target}${sameTime}`,
    early: span.isCurrent && differenceInCalendarDays(now, span.from!) < MIN_DAYS[period],
    name: NAME[period],
  };
}
