import Link from "next/link";
import { ChevronRight, Target } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { goalText, type WeeklyGoalSummary } from "@/lib/weekly-goal";

export const WEEKLY_GOAL_PATH = "/profile/settings/obiettivo";

/** "ne manca 1", "ne mancano 2", "mancano 6,5 km" */
function remaining(item: WeeklyGoalSummary["items"][number]): string {
  if (item.reached) return "fatto";
  const left = item.target - item.done;
  if (item.kind === "sessions") return left === 1 ? "ne manca 1" : `ne mancano ${left}`;
  return `mancano ${(Math.round(left * 10) / 10).toString().replace(".", ",")} km`;
}

/**
 * Obiettivo della settimana in Home: un anello per ogni obiettivo e le
 * settimane di fila raggiunte. Senza obiettivo, l'invito a sceglierne uno.
 */
export function WeekGoal({ goal }: { goal: WeeklyGoalSummary | undefined }) {
  if (!goal) return null;

  if (goal.items.length === 0) {
    return (
      <Link
        href={WEEKLY_GOAL_PATH}
        className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm active:bg-muted"
      >
        <Target className="h-5 w-5 shrink-0 text-lime-600 dark:text-lime-400" aria-hidden />
        <span className="flex-1">
          <span className="font-semibold">Scegli un obiettivo settimanale</span>
          <span className="block text-xs text-muted-foreground">Ti mostriamo a che punto sei ogni settimana</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <Link href={WEEKLY_GOAL_PATH} className="mt-4 block rounded-2xl bg-muted/60 p-3 active:bg-muted" aria-label="Obiettivo settimanale: modifica">
      <div className="flex items-center gap-3">
        {goal.items.map((item) => (
          <div key={item.kind} className="flex min-w-0 flex-1 items-center gap-2.5">
            <ProgressRing ratio={item.ratio} label={goalText(item)} />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold leading-tight tabular-nums">{goalText(item)}</p>
              <p className="truncate text-xs text-muted-foreground">{remaining(item)}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs">
        <span className="text-muted-foreground">
          {goal.reached ? "Obiettivo della settimana raggiunto" : "Obiettivo della settimana"}
        </span>
        <span className="font-semibold tabular-nums">
          {goal.weeksInARow > 0
            ? `${goal.weeksInARow} ${goal.weeksInARow === 1 ? "settimana" : "settimane"} di fila`
            : "Inizia la serie"}
        </span>
      </p>
    </Link>
  );
}
