"use client";

import { useMemo } from "react";
import { addDays, format, isSameMonth, startOfWeek, subWeeks } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutHistoryList } from "@/components/calendar/workout-history-list";
import { byDay, type ActivityItem } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { formatHours } from "./format";
import { Section } from "./ui";
import { useActivity } from "./use-activity";

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const HEATMAP_WEEKS = 26;

/** Ultimi 6 mesi: colonne = settimane, righe = giorni; più scuro = più tempo */
function Heatmap({ items }: { items: ActivityItem[] }) {
  const days = useMemo(() => byDay(items), [items]);
  const firstWeek = startOfWeek(subWeeks(new Date(), HEATMAP_WEEKS - 1), { weekStartsOn: 1 });
  const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => addDays(firstWeek, w * 7));
  const today = new Date();

  // Soglie di intensità dai tuoi stessi allenamenti (quartili della durata giornaliera)
  const durations = Array.from(days.values())
    .map((l) => l.reduce((s, i) => s + i.duration, 0))
    .sort((a, b) => a - b);
  const q = (p: number) => durations[Math.floor((durations.length - 1) * p)] ?? 0;
  const levels = [q(0.25), q(0.5), q(0.75)];
  const shade = (seconds: number) =>
    seconds <= levels[0] ? "bg-foreground/30" : seconds <= levels[1] ? "bg-foreground/50" : seconds <= levels[2] ? "bg-foreground/75" : "bg-foreground";

  const activeDays = weeks.flatMap((w) => Array.from({ length: 7 }, (_, d) => addDays(w, d))).filter((d) => days.has(dayKey(d))).length;

  return (
    <Section title="Ultimi 6 mesi" hint={`${activeDays} giorni attivi su ${HEATMAP_WEEKS} settimane`}>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))` }}>
        {weeks.map((w, i) => {
          const showMonth = i === 0 || !isSameMonth(w, weeks[i - 1]);
          return (
            <span key={`m-${i}`} className="h-4 overflow-visible whitespace-nowrap text-[10px] capitalize text-muted-foreground">
              {showMonth && i < HEATMAP_WEEKS - 1 ? format(w, "MMM", { locale: it }) : ""}
            </span>
          );
        })}
        {Array.from({ length: 7 }, (_, d) =>
          weeks.map((w) => {
            const day = addDays(w, d);
            const list = days.get(dayKey(day)) ?? [];
            const seconds = list.reduce((s, i) => s + i.duration, 0);
            const onlyRun = list.length > 0 && list.every((i) => i.kind === "run");
            const onlyOther = list.length > 0 && list.every((i) => i.kind === "cardio");
            return (
              <span
                key={dayKey(day)}
                title={`${format(day, "d MMM", { locale: it })}${list.length ? ` · ${formatHours(seconds)}` : ""}`}
                className={cn(
                  "aspect-square rounded-[3px]",
                  day > today
                    ? "bg-transparent"
                    : !list.length
                      ? "bg-muted"
                      : onlyRun
                        ? "bg-lime-500"
                        : onlyOther
                          ? "bg-sky-500"
                          : shade(seconds)
                )}
                style={{ gridRow: d + 2 }}
              />
            );
          })
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          Meno
          {["bg-muted", "bg-foreground/30", "bg-foreground/50", "bg-foreground/75", "bg-foreground"].map((c) => (
            <span key={c} className={cn("h-2.5 w-2.5 rounded-[3px]", c)} />
          ))}
          Più tempo
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-lime-500" /> Solo corsa
          </span>
          {items.some((i) => i.kind === "cardio") && (
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-sky-500" /> Bici e altro
            </span>
          )}
        </span>
      </div>
    </Section>
  );
}

/**
 * Storico: la mappa degli ultimi 6 mesi e l'elenco di tutti gli allenamenti.
 * Il calendario del mese sta nel Riepilogo, insieme al periodo scelto.
 */
export function HistoryTab() {
  const { data: items, isLoading } = useActivity();
  if (isLoading || !items) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Heatmap items={items} />
      <section>
        <h2 className="mb-2 px-1 font-display text-xl font-bold uppercase tracking-wide">Tutti gli allenamenti</h2>
        <WorkoutHistoryList />
      </section>
    </div>
  );
}
