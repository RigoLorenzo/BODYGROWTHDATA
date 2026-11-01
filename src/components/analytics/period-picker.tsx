"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, isValid, parse, startOfMonth, startOfYear } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { periodLabel, periodStart, periodWindow, shiftPeriod, type ActivityItem, type Period } from "@/lib/insights";

const PERIODS: readonly Period[] = ["week", "month", "year", "all"];
const DEFAULT_PERIOD: Period = "month";
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Periodo del Riepilogo nell'URL (?periodo=settimana…&del=2026-10-01): aprendo
 * un allenamento e tornando indietro resta il mese che stavi guardando.
 * Senza parametri: il mese in corso.
 */
export function usePeriodSelection(now: Date) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const requested = params.get("periodo") as Period | null;
  const period = requested && PERIODS.includes(requested) ? requested : DEFAULT_PERIOD;
  const parsed = params.get("del") ? parse(params.get("del")!, "yyyy-MM-dd", now) : null;
  // Mai oltre il periodo in corso
  const anchor = parsed && isValid(parsed) && parsed <= now ? parsed : now;

  const update = (next: Period, nextAnchor: Date) => {
    const query = new URLSearchParams(params);
    if (next === DEFAULT_PERIOD) query.delete("periodo");
    else query.set("periodo", next);
    const current = next === "all" || periodWindow(next, nextAnchor, now).isCurrent;
    if (current) query.delete("del");
    else query.set("del", format(periodStart(next as Exclude<Period, "all">, nextAnchor), "yyyy-MM-dd"));
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return {
    period,
    anchor,
    // Cambiando tipo di periodo si resta sulla stessa data (ottobre → la sua settimana, il suo anno)
    setPeriod: (next: Period) => update(next, anchor),
    setAnchor: (next: Date) => update(period, next),
    setMonth: (next: Date) => update("month", next),
  };
}

interface NavigatorProps {
  period: Period;
  anchor: Date;
  now: Date;
  /** prima seduta registrata: prima non c'è nulla da vedere */
  first: Date | null;
  onChange: (anchor: Date) => void;
  onOpenPicker: () => void;
}

/** Frecce e nome del periodo; toccando il nome si sceglie il mese (o l'anno) */
export function PeriodNavigator({ period, anchor, now, first, onChange, onOpenPicker }: NavigatorProps) {
  if (period === "all") return null;
  const span = periodWindow(period, anchor, now);
  const canGoBack = !!first && span.from! > periodStart(period, first);
  const pickable = period !== "week";
  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background/10 transition active:scale-90 disabled:opacity-25";

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(shiftPeriod(period, anchor, -1))}
        disabled={!canGoBack}
        aria-label="Periodo precedente"
        className={arrow}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={pickable ? onOpenPicker : undefined}
        disabled={!pickable}
        aria-haspopup={pickable ? "dialog" : undefined}
        className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl px-2 active:bg-background/10 disabled:active:bg-transparent"
      >
        <span className="flex max-w-full items-center gap-1 font-display text-xl font-bold uppercase tracking-wide">
          <span className="truncate">{capitalize(periodLabel(period, anchor))}</span>
          {pickable && <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />}
        </span>
        {!span.isCurrent && (
          <span className="text-[11px] uppercase tracking-wider opacity-60">periodo concluso</span>
        )}
      </button>
      {span.isCurrent ? (
        <button type="button" disabled aria-label="Periodo successivo" className={arrow}>
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onChange(shiftPeriod(period, anchor, 1))}
          aria-label="Periodo successivo"
          className={arrow}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/** Torna al periodo in corso, visibile solo quando stai guardando il passato */
export function BackToToday({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-2 flex h-9 items-center gap-1.5 rounded-full bg-lime-400 px-3.5 text-xs font-bold uppercase tracking-wide text-zinc-950 active:scale-95"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Torna a oggi
    </button>
  );
}

/** Quanto ti sei allenato in ogni mese (chiave yyyy-MM) */
function sessionsByMonth(items: ActivityItem[]) {
  const map = new Map<string, number>();
  for (const i of items) {
    const key = format(i.startedAt, "yyyy-MM");
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/** Più sedute, più intenso il colore: quattro livelli rispetto al mese migliore dell'anno */
function intensity(sessions: number, max: number) {
  if (!sessions) return "bg-muted/60 text-muted-foreground";
  const r = sessions / Math.max(1, max);
  if (r > 0.75) return "bg-lime-400 text-zinc-950";
  if (r > 0.5) return "bg-lime-400/70 text-zinc-950";
  if (r > 0.25) return "bg-lime-400/40";
  return "bg-lime-400/20";
}

interface PickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: "month" | "year";
  anchor: Date;
  now: Date;
  first: Date | null;
  items: ActivityItem[];
  onSelect: (anchor: Date) => void;
}

/**
 * Scelta rapida del mese: un anno alla volta, ogni mese colorato in base a
 * quanto ti sei allenato. In modalità anno, gli anni con i loro totali.
 */
export function PeriodPickerDialog({ open, onOpenChange, period, anchor, now, first, items, onSelect }: PickerProps) {
  const [year, setYear] = useState(() => anchor.getFullYear());
  const counts = useMemo(() => sessionsByMonth(items), [items]);
  const firstMonth = first ? startOfMonth(first) : startOfMonth(now);
  const firstYear = firstMonth.getFullYear();
  const choose = (date: Date) => {
    onSelect(date);
    onOpenChange(false);
  };

  const months = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1));
  const monthCount = (d: Date) => counts.get(format(d, "yyyy-MM")) ?? 0;
  const maxInYear = Math.max(0, ...months.map(monthCount));
  const years = Array.from({ length: now.getFullYear() - firstYear + 1 }, (_, i) => now.getFullYear() - i);
  const yearCount = (y: number) =>
    Array.from({ length: 12 }, (_, m) => counts.get(format(new Date(y, m, 1), "yyyy-MM")) ?? 0).reduce((s, v) => s + v, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) setYear(anchor.getFullYear());
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-w-sm gap-4 rounded-3xl p-5">
        <div>
          <DialogTitle className="font-display text-2xl font-bold uppercase tracking-wide">
            {period === "month" ? "Scegli il mese" : "Scegli l'anno"}
          </DialogTitle>
          <DialogDescription className="text-xs">Più è acceso, più ti sei allenato.</DialogDescription>
        </div>

        {period === "month" ? (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                disabled={year <= firstYear}
                aria-label="Anno precedente"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-muted active:scale-90 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="font-display text-3xl font-extrabold tabular-nums" aria-live="polite">
                {year}
              </p>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                disabled={year >= now.getFullYear()}
                aria-label="Anno successivo"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-muted active:scale-90 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((month) => {
                const count = monthCount(month);
                const disabled = month > now || month < firstMonth;
                const selected = format(month, "yyyy-MM") === format(anchor, "yyyy-MM");
                const isNow = format(month, "yyyy-MM") === format(now, "yyyy-MM");
                return (
                  <button
                    key={month.toISOString()}
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(month)}
                    aria-pressed={selected}
                    aria-label={`${format(month, "MMMM yyyy", { locale: it })}: ${count} allenamenti`}
                    className={cn(
                      "relative flex h-[68px] flex-col items-center justify-center rounded-2xl transition active:scale-95 disabled:opacity-30",
                      intensity(count, maxInYear),
                      selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    )}
                  >
                    <span className="font-display text-lg font-bold uppercase leading-none">
                      {format(month, "MMM", { locale: it })}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold tabular-nums opacity-80">{disabled ? "—" : count}</span>
                    {isNow && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {years.map((y) => {
              const selected = y === anchor.getFullYear();
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => choose(startOfYear(new Date(y, 0, 1)))}
                  aria-pressed={selected}
                  className={cn(
                    "flex h-[68px] flex-col items-center justify-center rounded-2xl bg-muted/60 active:scale-95",
                    selected && "bg-lime-400 text-zinc-950"
                  )}
                >
                  <span className="font-display text-xl font-bold tabular-nums">{y}</span>
                  <span className="text-[11px] font-semibold tabular-nums opacity-70">{yearCount(y)} allen.</span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const PERIOD_OPTIONS = [
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
  { value: "year", label: "Anno" },
  { value: "all", label: "Sempre" },
] as const;
