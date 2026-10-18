import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatDuration, formatKm, formatPace, paceSecondsPerKm } from "@/lib/run/format";
import { RouteMap } from "./route-map";
import type { RunListItem } from "./types";

const SOURCE_LABEL = { STRAVA: "Strava", MI_FITNESS: "Mi Fitness", GPX: "GPX", MANUAL: "Manuale" } as const;

/** Elenco attività con miniatura del percorso */
export function RunList({ runs }: { runs: RunListItem[] }) {
  return (
    <ul className="overflow-hidden rounded-3xl border border-border/60 bg-card">
      {runs.map((run) => {
        const date = new Date(run.startedAt);
        return (
          <li key={run.id} className="border-b border-border/50 last:border-0">
            <Link href={`/run/${run.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted/50">
              <RouteMap polyline={run.polyline} className="h-14 w-14 shrink-0 rounded-xl" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{run.name}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {format(date, "EEE d MMM", { locale: it })} · {SOURCE_LABEL[run.source]}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {formatDuration(run.movingTime)} · {formatPace(paceSecondsPerKm(run.distance, run.movingTime))}/km
                  {run.avgHeartRate ? ` · ${run.avgHeartRate} bpm` : ""}
                </p>
              </div>
              <p className="shrink-0 font-display text-xl font-bold tabular-nums">
                {formatKm(run.distance)}
                <span className="ml-0.5 text-xs font-medium text-muted-foreground">km</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
