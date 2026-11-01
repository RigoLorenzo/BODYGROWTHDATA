"use client";

import { useState } from "react";
import Link from "next/link";
import { eachDayOfInterval, format, getDay, isToday, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { byDay, itemsInPeriod, periodLabel, type ActivityItem, type Period, type PeriodWindow } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { formatHours } from "./format";
import { KIND_STYLE, activityMetric } from "./activity-kind";
import { ActivityLegend, EmptyState, Section } from "./ui";
import { activityHref } from "./use-activity";

/** Sedute mostrate prima di "Mostra tutte" */
const VISIBLE = 6;
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

/** Il mese a colpo d'occhio: ogni giorno colorato per palestra, corsa o entrambe */
function MonthDots({ from, to, items }: { from: Date; to: Date; items: ActivityItem[] }) {
  const days = byDay(items);
  const list = eachDayOfInterval({ start: from, end: subDays(to, 1) });
  const pad = (getDay(from) + 6) % 7;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
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
          const gym = sessions.some((s) => s.kind === "gym");
          // Corsa, bici e altro insieme: il colore della resistenza
          const run = sessions.some((s) => s.kind === "run");
          const other = !run && sessions.some((s) => s.kind === "cardio");
          return (
            <span
              key={dayKey(day)}
              title={`${format(day, "d MMMM", { locale: it })}: ${sessions.length || "nessun"} allenament${sessions.length === 1 ? "o" : "i"}`}
              className={cn(
                "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg text-[11px] font-semibold tabular-nums",
                gym && run
                  ? "bg-foreground text-background"
                  : gym
                    ? "bg-foreground/80 text-background"
                    : run
                      ? "bg-lime-500 text-zinc-950"
                      : other
                        ? "bg-sky-500 text-white"
                        : "bg-muted/60 text-muted-foreground",
                isToday(day) && "ring-2 ring-inset ring-lime-500"
              )}
            >
              {format(day, "d")}
              {gym && run && <span className="absolute bottom-0 left-0 h-1 w-full bg-lime-500" aria-hidden />}
            </span>
          );
        })}
      </div>
      <ActivityLegend className="mt-3 justify-center" other={items.some((i) => i.kind === "cardio")} />
    </div>
  );
}

function KindGlyph({ kind }: { kind: ActivityItem["kind"] }) {
  const Icon = KIND_STYLE[kind].icon;
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />;
}

function SessionRow({ item }: { item: ActivityItem }) {
  return (
    <li>
      <Link href={activityHref(item)} className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3 active:bg-muted">
        <span className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl leading-none", KIND_STYLE[item.kind].tile)}>
          <span className="font-display text-base font-bold tabular-nums">{format(item.startedAt, "d")}</span>
          <span className="text-[9px] font-semibold uppercase">{format(item.startedAt, "EEE", { locale: it })}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <KindGlyph kind={item.kind} />
            <span className="truncate">{item.title}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {format(item.startedAt, "HH:mm")} · {formatHours(item.duration)}
          </p>
        </div>
        <p className="shrink-0 font-display text-lg font-bold tabular-nums">{activityMetric(item)}</p>
      </Link>
    </li>
  );
}

/** Gli allenamenti del periodo scelto, dal più recente; per il mese anche il calendario */
export function PeriodActivity({
  items,
  period,
  anchor,
  span,
}: {
  items: ActivityItem[];
  period: Period;
  anchor: Date;
  span: PeriodWindow;
}) {
  const [expanded, setExpanded] = useState(false);
  if (period === "all" || !span.from || !span.to) return null;

  const sessions = itemsInPeriod(items, span).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const visible = expanded ? sessions : sessions.slice(0, VISIBLE);
  const title = period === "week" ? "Allenamenti della settimana" : period === "month" ? "Allenamenti del mese" : "Allenamenti dell'anno";

  return (
    <Section title={title} hint={periodLabel(period, anchor)}>
      {period === "month" && <MonthDots from={span.from} to={span.to} items={sessions} />}
      {sessions.length === 0 ? (
        <EmptyState>Nessun allenamento in questo periodo.</EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((item) => (
              <SessionRow key={item.id} item={item} />
            ))}
          </ul>
          {sessions.length > VISIBLE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted/50"
            >
              {expanded ? "Mostra meno" : `Mostra tutti (${sessions.length})`}
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
            </button>
          )}
        </>
      )}
    </Section>
  );
}
