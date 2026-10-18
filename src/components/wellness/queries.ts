"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { SleepJson, WellnessDayJson, WellnessResponse } from "@/lib/wellness/types";

export const useWellness = () =>
  useQuery<WellnessResponse>({
    queryKey: ["wellness"],
    queryFn: async () => {
      const res = await fetch("/api/wellness?days=120");
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });

/** Giorni indicizzati per data, per i grafici a giorni fissi */
export function useDayIndex(days: WellnessDayJson[] | undefined) {
  return useMemo(() => new Map((days ?? []).map((d) => [d.date, d])), [days]);
}

export const dayLabel = (date: string) => format(parseISO(date), "d MMM", { locale: it });
export const longDayLabel = (date: string) => format(parseISO(date), "EEEE d MMMM", { locale: it });
export const timeLabel = (iso: string) => format(new Date(iso), "HH:mm");

export const nightsByDate = (sleeps: SleepJson[]) => new Map(sleeps.map((s) => [s.date, s]));
