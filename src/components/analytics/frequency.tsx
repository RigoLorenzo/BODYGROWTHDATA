"use client";

import { addDays, eachDayOfInterval, format, getDay, isToday, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { byDay, itemsInPeriod, periodConsistency, periodStart, periodWindow, type ActivityItem, type Period } from "@/lib/insights";
import { cn } from "@/lib/utils";

/**
 * La frequenza in un posto solo, con la vista giusta per il periodo: i sette
 * giorni della settimana, il calendario del mese, le settimane dell'anno. Sotto,
 * al massimo tre numeri.
 */

/** Come colorare un giorno: per tipo di attività o per intensità */
export type DayTone = (sessions: ActivityItem[]) => { className: string; mark?: string } | null;

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/* ─── Il giorno: tipo di allenamento e doppi allenamenti ─── */

export interface DayParts {
  gym: number;
  run: number;
  other: number;
}

export const partsOf = (sessions: ActivityItem[]): DayParts => ({
  gym: sessions.filter((s) => s.kind === "gym").length,
  run: sessions.filter((s) => s.kind === "run").length,
  other: sessions.filter((s) => s.kind === "cardio").length,
});

/** Colori dei tipi: gli stessi di barre e legende */
const KIND_FILL = { gym: "hsl(var(--foreground))", run: "#84cc16", other: "#0ea5e9" } as const;
const KIND_TEXT = { gym: "text-background", run: "text-zinc-950", other: "text-white" } as const;
const KIND_NAME = { gym: "palestra", run: "corsa", other: "altro" } as const;

/** "palestra e corsa (2 allenamenti)" per chi usa lo screen reader */
export function describeDay(parts: DayParts) {
  const kinds = (Object.keys(KIND_NAME) as (keyof DayParts)[]).filter((k) => parts[k] > 0);
  const count = parts.gym + parts.run + parts.other;
  if (!count) return "riposo";
  const names = kinds.map((k) => KIND_NAME[k]).join(" e ");
  return count > 1 ? `${names} (${count} allenamenti)` : names;
}

/**
 * Il segno del giorno, uguale in Home, settimana e calendario: un colore per
 * tipo; due tipi diversi (es. palestra e corsa) si dividono il riquadro a
 * metà; più sedute dello stesso giorno mostrano il numero nell'angolo.
 */
export function DayMark({
  parts,
  label,
  className,
  empty,
}: {
  parts: DayParts;
  label: string;
  /** forma e dimensione (rounded-full, rounded-lg, aspect-square…) */
  className?: string;
  /** classe per i giorni senza allenamento */
  empty?: string;
}) {
  const kinds = (Object.keys(KIND_FILL) as (keyof DayParts)[]).filter((k) => parts[k] > 0);
  const count = parts.gym + parts.run + parts.other;
  if (!count) {
    return <span className={cn("relative flex items-center justify-center", className, empty ?? "bg-muted/60 text-muted-foreground")}>{label}</span>;
  }
  const split = kinds.length > 1;
  // Doppio: il riquadro diviso in diagonale, il numero su una pastiglia leggibile
  const background = split
    ? `linear-gradient(135deg, ${kinds.map((k, i) => `${KIND_FILL[k]} ${(i / kinds.length) * 100}% ${((i + 1) / kinds.length) * 100}%`).join(", ")})`
    : KIND_FILL[kinds[0]];
  return (
    <span className={cn("relative flex items-center justify-center", className, !split && KIND_TEXT[kinds[0]])} style={{ background }}>
      {split ? (
        <span className="flex h-[1.35em] min-w-[1.35em] items-center justify-center rounded-full bg-background px-1 text-foreground">{label}</span>
      ) : (
        label
      )}
      {count > 1 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-0.5 text-[9px] font-bold text-foreground ring-1 ring-border"
          aria-hidden
        >
          {count}
        </span>
      )}
    </span>
  );
}

/** Legenda dei segni: solo i tipi presenti, più "Doppio" se c'è un giorno con due tipi */
export function DayLegend({ days, className }: { days: DayParts[]; className?: string }) {
  const has = (k: keyof DayParts) => days.some((d) => d[k] > 0);
  const double = days.some((d) => [d.gym, d.run, d.other].filter((n) => n > 0).length > 1);
  const entries = [
    has("gym") && { key: "gym", label: "Palestra", style: { background: KIND_FILL.gym } },
    has("run") && { key: "run", label: "Corsa", style: { background: KIND_FILL.run } },
    has("other") && { key: "other", label: "Bici e altro", style: { background: KIND_FILL.other } },
    double && { key: "double", label: "Doppio allenamento", style: { background: `linear-gradient(135deg, ${KIND_FILL.gym} 50%, ${KIND_FILL.run} 50%)` } },
  ].filter(Boolean) as { key: string; label: string; style: React.CSSProperties }[];
  if (!entries.length) return null;
  return (
    <p className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground", className)}>
      {entries.map((e) => (
        <span key={e.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={e.style} aria-hidden />
          {e.label}
        </span>
      ))}
    </p>
  );
}

function Week({ items, anchor, now, tone }: { items: ActivityItem[]; anchor: Date; now: Date; tone?: DayTone }) {
  const days = byDay(items);
  const monday = periodStart("week", anchor);
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i);
        const sessions = days.get(dayKey(day)) ?? [];
        const future = day > now;
        if (!tone) {
          return (
            <div key={i} className="flex flex-col items-center gap-1.5" title={format(day, "EEEE d MMMM", { locale: it })}>
              <DayMark
                parts={partsOf(sessions)}
                label={format(day, "d")}
                className={cn(
                  "aspect-square w-full max-w-10 rounded-full text-xs font-semibold tabular-nums",
                  isToday(day) && "ring-2 ring-lime-500 ring-offset-2 ring-offset-background"
                )}
                empty={future ? "border border-dashed border-border text-muted-foreground/60" : "bg-muted text-muted-foreground"}
              />
              <span className="sr-only">{describeDay(partsOf(sessions))}</span>
              <span className="text-[10px] font-medium uppercase text-muted-foreground">{format(day, "EEEEE", { locale: it })}</span>
            </div>
          );
        }
        const style = sessions.length ? tone(sessions) : null;
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

function Month({ items, from, to, tone }: { items: ActivityItem[]; from: Date; to: Date; tone?: DayTone }) {
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
          if (!tone) {
            return (
              <span key={dayKey(day)} title={`${format(day, "EEEE d MMMM", { locale: it })}: ${describeDay(partsOf(sessions))}`}>
                <DayMark
                  parts={partsOf(sessions)}
                  label={format(day, "d")}
                  className={cn("aspect-square w-full rounded-lg text-[11px] font-semibold tabular-nums", isToday(day) && "ring-2 ring-inset ring-lime-500")}
                />
              </span>
            );
          }
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
  tone,
  weekClass = "bg-foreground",
  facts,
}: {
  items: ActivityItem[];
  period: Period;
  anchor: Date;
  now: Date;
  /** colore personalizzato dei giorni (es. intensità dei km); senza: tipo di allenamento e doppi */
  tone?: DayTone;
  /** colore delle settimane attive (anno, sempre) */
  weekClass?: string;
  facts: Fact[];
}) {
  const span = periodWindow(period, anchor, now);
  const dayParts = [...byDay(itemsInPeriod(items, span)).values()].map(partsOf);
  return (
    <div className="space-y-5">
      {period === "week" ? (
        <Week items={items} anchor={anchor} now={now} tone={tone} />
      ) : period === "month" ? (
        <Month items={items} from={span.from!} to={span.to!} tone={tone} />
      ) : (
        <Weeks cells={periodConsistency(items, period, anchor, now).cells} activeClass={weekClass} />
      )}
      {!tone && (period === "week" || period === "month") && <DayLegend days={dayParts} />}
      <Facts facts={facts} />
    </div>
  );
}
