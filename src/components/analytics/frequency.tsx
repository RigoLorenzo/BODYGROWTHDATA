"use client";

import { addDays, eachDayOfInterval, format, getDay, isToday, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { byDay, periodConsistency, periodStart, periodWindow, type ActivityItem, type Period } from "@/lib/insights";
import { cn } from "@/lib/utils";

/**
 * La frequenza in un posto solo, con la vista giusta per il periodo: i sette
 * giorni della settimana, il calendario del mese, le settimane dell'anno. Sotto,
 * al massimo tre numeri.
 */

/** Come colorare un giorno: per tipo di attività o per intensità */
export type DayTone = (sessions: ActivityItem[]) => { className: string; mark?: string } | null;

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/** Palestra scura, corsa verde, altro azzurro; un segno in basso se nello stesso giorno c'è anche altro */
export const kindDayTone: DayTone = (sessions) => {
  const gym = sessions.some((s) => s.kind === "gym");
  const run = sessions.some((s) => s.kind === "run");
  const other = sessions.some((s) => s.kind === "cardio");
  if (gym) return { className: "bg-foreground text-background", mark: run ? "bg-lime-500" : other ? "bg-sky-500" : undefined };
  if (run) return { className: "bg-lime-500 text-zinc-950" };
  if (other) return { className: "bg-sky-500 text-white" };
  return null;
};

function Week({ items, anchor, now, tone }: { items: ActivityItem[]; anchor: Date; now: Date; tone: DayTone }) {
  const days = byDay(items);
  const monday = periodStart("week", anchor);
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i);
        const sessions = days.get(dayKey(day)) ?? [];
        const style = sessions.length ? tone(sessions) : null;
        const future = day > now;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "relative flex aspect-square w-full max-w-10 items-center justify-center overflow-hidden rounded-full text-xs font-semibold tabular-nums",
                style?.className ?? (future ? "border border-dashed border-border text-muted-foreground/60" : "bg-muted text-muted-foreground"),
                isToday(day) && "ring-2 ring-lime-500 ring-offset-2 ring-offset-background"
              )}
              title={format(day, "EEEE d MMMM", { locale: it })}
            >
              {format(day, "d")}
              {style?.mark && <span className={cn("absolute bottom-0 left-0 h-1 w-full", style.mark)} aria-hidden />}
            </span>
            <span className="text-[10px] font-medium uppercase text-muted-foreground">{format(day, "EEEEE", { locale: it })}</span>
          </div>
        );
      })}
    </div>
  );
}

function Month({ items, from, to, tone }: { items: ActivityItem[]; from: Date; to: Date; tone: DayTone }) {
  const days = byDay(items);
  const list = eachDayOfInterval({ start: from, end: subDays(to, 1) });
  const pad = (getDay(from) + 6) % 7;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground" aria-hidden>
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: pad }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {list.map((day) => {
          const sessions = days.get(dayKey(day)) ?? [];
          const style = sessions.length ? tone(sessions) : null;
          return (
            <span
              key={dayKey(day)}
              title={format(day, "EEEE d MMMM", { locale: it })}
              className={cn(
                "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold tabular-nums",
                style?.className ?? "bg-muted/60 text-muted-foreground",
                isToday(day) && "ring-2 ring-inset ring-lime-500"
              )}
            >
              {format(day, "d")}
              {style?.mark && <span className={cn("absolute bottom-0 left-0 h-1 w-full", style.mark)} aria-hidden />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Una pallina per settimana: si vede subito dove ti sei fermato */
function Weeks({ cells, activeClass }: { cells: { start: Date; active: boolean }[]; activeClass: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${cells.filter((c) => c.active).length} settimane attive su ${cells.length}`}>
      {cells.map((c) => (
        <span
          key={c.start.toISOString()}
          title={`Settimana del ${format(c.start, "d MMM", { locale: it })}`}
          className={cn("h-3.5 w-3.5 rounded-full", c.active ? activeClass : "bg-muted")}
        />
      ))}
    </div>
  );
}

export interface Fact {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}

/** Al massimo tre numeri in fila, separati da una linea sottile */
export function Facts({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <dl className="grid divide-x divide-border/60" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
      {facts.map((f) => (
        <div key={f.label} className="min-w-0 px-3 first:pl-0 last:pr-0">
          <dt className="truncate text-xs text-muted-foreground">{f.label}</dt>
          <dd className="font-display text-2xl font-bold leading-tight tabular-nums">{f.value}</dd>
          {f.detail && <dd className="truncate text-xs text-muted-foreground">{f.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Frequency({
  items,
  period,
  anchor,
  now,
  tone = kindDayTone,
  weekClass = "bg-foreground",
  facts,
}: {
  items: ActivityItem[];
  period: Period;
  anchor: Date;
  now: Date;
  tone?: DayTone;
  /** colore delle settimane attive (anno, sempre) */
  weekClass?: string;
  facts: Fact[];
}) {
  const span = periodWindow(period, anchor, now);
  return (
    <div className="space-y-5">
      {period === "week" ? (
        <Week items={items} anchor={anchor} now={now} tone={tone} />
      ) : period === "month" ? (
        <Month items={items} from={span.from!} to={span.to!} tone={tone} />
      ) : (
        <Weeks cells={periodConsistency(items, period, anchor, now).cells} activeClass={weekClass} />
      )}
      <Facts facts={facts} />
    </div>
  );
}
