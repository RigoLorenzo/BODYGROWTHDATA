"use client";

import { Flame } from "lucide-react";
import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import { periodConsistency, records, type ActivityItem, type Period } from "@/lib/insights";
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

/**
 * Costanza nel periodo: quante settimane (o giorni) attive, la media e la
 * streak. In fondo, l'abitudine più evidente in una frase.
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

  return (
    <Section title="Costanza">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {c.unit === "days" ? "Giorni attivi" : "Settimane attive"}
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {c.active}/{c.total}
          <span className="ml-1 font-normal text-muted-foreground">· {c.percent}%</span>
        </p>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={c.percent}
        aria-label={c.unit === "days" ? "Giorni attivi" : "Settimane attive"}
      >
        <div className="h-full rounded-full bg-lime-500" style={{ width: `${c.percent}%` }} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        {/* Nella settimana il totale è già il numero principale in alto */}
        {c.unit === "weeks" && <Stat label="Media" value={formatDecimal(c.avgPerWeek)} unit="a settimana" />}
        <Stat
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1">
              {streak}
              <Flame className={cn("h-5 w-5", streak > 0 ? "text-orange-500" : "text-muted-foreground")} aria-hidden />
            </span>
          }
          unit={streak === 1 ? "giorno" : "giorni"}
          detail={`Record ${overview?.longestStreak ?? 0}`}
        />
      </div>

      {habit && <p className="mt-4 border-t border-border/60 pt-3 text-sm text-muted-foreground">{habit}</p>}
    </Section>
  );
}
