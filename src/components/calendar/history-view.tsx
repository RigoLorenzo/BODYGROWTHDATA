"use client";

import { useMemo } from "react";
import Link from "next/link";
import { isValid, parse } from "date-fns";
import { X } from "lucide-react";
import { WorkoutHistoryList } from "./workout-history-list";

/** "2026-10-01" → mezzanotte locale di chi guarda */
const parseDay = (raw?: string) => {
  if (!raw) return null;
  const date = parse(raw, "yyyy-MM-dd", new Date());
  return isValid(date) ? date : null;
};

/** Storico, eventualmente limitato al periodo aperto dal Riepilogo */
export function HistoryView({ from, to, label }: { from?: string; to?: string; label?: string }) {
  const range = useMemo(() => {
    const start = parseDay(from);
    const end = parseDay(to);
    return start && end && start < end ? { from: start, to: end } : undefined;
  }, [from, to]);

  return (
    <div className="space-y-4">
      {range && (
        <Link
          href="/history"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background active:scale-95"
          aria-label={`Rimuovi il filtro ${label ?? "periodo"}`}
        >
          <span className="first-letter:uppercase">{label ?? "Periodo"}</span>
          <X className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
      <WorkoutHistoryList range={range} />
    </div>
  );
}
