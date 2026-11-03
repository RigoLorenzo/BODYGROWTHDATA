"use client";

import { addDays, format } from "date-fns";
import { it } from "date-fns/locale";
import { Flame } from "lucide-react";
import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import { periodConsistency, periodStart, records, type ActivityItem, type Period } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { formatDecimal } from "./format";
import { Section, Stat } from "./ui";

/** Sotto questa soglia giorno e orario preferiti non dicono nulla */
const HABIT_MIN_SESSIONS = 4;

/** "Ti alleni soprattutto il lunedì, di sera." */
function habitSentence(items: ActivityItem[]): string | null {
  if (items.length < HABIT_MIN_SESSIONS) return null;
  const r = records(items);
  if (!r.favoriteDay || !r.favoriteSlot) return null;
  const slot = r.favoriteSlot.label.toLowerCase();
  const day = r.favoriteDay.name.toLowerCase();
  return `Ti alleni soprattutto ${day === "domenica" ? "la" : "il"} ${day}, ${slot === "notte" ? "di notte" : `di ${slot}`}.`;
}

/** Il giudizio in una frase, così non serve leggere i numeri */
function verdict(percent: number, unit: "days" | "weeks", missed: number) {
  if (unit === "days") {
    if (percent >= 70) return "Settimana molto attiva.";
    if (percent >= 40) return "Buon ritmo questa settimana.";
    return "Settimana tranquilla finora.";
  }
  if (percent >= 90) return "Ti alleni quasi ogni settimana: ottimo.";
  if (percent >= 70) return `Buona costanza: ${missed} ${missed === 1 ? "settimana saltata" : "settimane saltate"}.`;
  if (percent >= 40) return `Costanza a metà: ${missed} settimane senza allenamenti.`;
  return "Poche settimane attive: anche un allenamento a settimana fa la differenza.";
}

/** Nella settimana: i sette giorni con l'iniziale, pieni se ti sei allenato */
function DayDots({ cells, anchor }: { cells: { start: Date; active: boolean }[]; anchor: Date }) {
  const monday = periodStart("week", anchor);
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i);
        const cell = cells[i];
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "h-8 w-8 rounded-full",
                !cell ? "border border-dashed border-border" : cell.active ? "bg-lime-500" : "bg-muted"
              )}
              aria-label={`${format(day, "EEEE", { locale: it })}: ${!cell ? "deve ancora arrivare" : cell.active ? "allenamento" : "riposo"}`}
            />
            <span className="text-[10px] font-medium uppercase text-muted-foreground">{format(day, "EEEEE", { locale: it })}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Una pallina per settimana: si vede subito dove ti sei fermato */
function WeekDots({ cells }: { cells: { start: Date; active: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${cells.filter((c) => c.active).length} settimane attive su ${cells.length}`}>
      {cells.map((c) => (
        <span
          key={c.start.toISOString()}
          title={`Settimana del ${format(c.start, "d MMM", { locale: it })}`}
          className={cn("h-3.5 w-3.5 rounded-full", c.active ? "bg-lime-500" : "bg-muted")}
        />
      ))}
    </div>
  );
}

/**
 * Costanza nel periodo: giorni (o settimane) attivi come una fila di
 * palline, la media e la streak. In fondo, l'abitudine più evidente.
 */
export function PeriodConsistency({
  all,
  inPeriod,
  period,
  anchor,
  now,
}: {
  all: ActivityItem[];
  inPeriod: ActivityItem[];
  period: Period;
  anchor: Date;
  now: Date;
}) {
  const { data: overview } = useAnalyticsOverview();
  const c = periodConsistency(all, period, anchor, now);
  const streak = overview?.streak ?? 0;
  const habit = habitSentence(inPeriod);
  const shown = c.cells.length;
  const missed = c.total - c.active;

  return (
    <Section
      title="Costanza"
      hint={
        <span className="text-sm text-foreground">
          <span className="font-semibold tabular-nums">
            {c.active} su {c.total}
          </span>{" "}
          {c.unit === "days" ? "giorni con allenamento" : "settimane con almeno un allenamento"}
        </span>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">{verdict(c.percent, c.unit, missed)}</p>
      {c.unit === "days" ? <DayDots cells={c.cells} anchor={anchor} /> : <WeekDots cells={c.cells} />}
      {c.unit === "weeks" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-lime-500" aria-hidden /> settimana con allenamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" aria-hidden /> senza
          </span>
          {shown < c.total && <span>· ultime {shown}</span>}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
        {/* Nella settimana il totale è già il numero principale in alto */}
        {c.unit === "weeks" && <Stat label="In media" value={formatDecimal(c.avgPerWeek)} unit={c.avgPerWeek === 1 ? "allenamento a settimana" : "allenamenti a settimana"} />}
        <Stat
          label="Giorni di fila"
          value={
            <span className="inline-flex items-center gap-1">
              {streak}
              <Flame className={cn("h-5 w-5", streak > 0 ? "text-orange-500" : "text-muted-foreground")} aria-hidden />
            </span>
          }
          detail={`Il tuo record: ${overview?.longestStreak ?? 0} giorni`}
        />
      </div>

      {habit && <p className="mt-4 border-t border-border/60 pt-3 text-sm text-muted-foreground">{habit}</p>}
    </Section>
  );
}
