import { format } from "date-fns";
import { it } from "date-fns/locale";
import { formatKm } from "@/lib/run/format";
import { cn } from "@/lib/utils";
import type { RunStats } from "./types";

interface Props {
  weekly: RunStats["weekly"];
  goalKm: number | null;
}

/** Km per settimana nelle ultime 12 settimane, con la linea dell'obiettivo */
export function WeeklyChart({ weekly, goalKm }: Props) {
  const goal = goalKm ? goalKm * 1000 : 0;
  const max = Math.max(goal, ...weekly.map((w) => w.distance), 1000);
  const last = weekly.length - 1;

  return (
    <div>
      <div className="relative flex h-32 items-end gap-1.5">
        {goal > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50"
            style={{ bottom: `${(goal / max) * 100}%` }}
            aria-hidden
          />
        )}
        {weekly.map((w, i) => (
          <div key={w.weekStart} className="flex h-full flex-1 flex-col justify-end" title={`${formatKm(w.distance)} km`}>
            <div
              className={cn(
                "w-full rounded-t-md",
                i === last ? "bg-lime-500" : w.distance > 0 ? "bg-foreground/70" : "bg-muted"
              )}
              style={{ height: w.distance > 0 ? `${Math.max(4, (w.distance / max) * 100)}%` : "4px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted-foreground">
        {weekly.map((w, i) => (
          <span key={w.weekStart} className="flex-1 text-center">
            {i % 3 === last % 3 ? format(new Date(w.weekStart), "d/M", { locale: it }) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
