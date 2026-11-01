import { Bike, Dumbbell, Footprints, type LucideIcon } from "lucide-react";
import type { ActivityItem } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { formatVolume } from "@/lib/utils";
import { formatHours } from "./format";

/** Come si mostra ogni tipo di attività: palestra, corsa, bici e altro */
export const KIND_STYLE: Record<ActivityItem["kind"], { icon: LucideIcon; label: string; tile: string; dot: string }> = {
  gym: { icon: Dumbbell, label: "Palestra", tile: "bg-foreground/10", dot: "bg-foreground" },
  run: { icon: Footprints, label: "Corsa", tile: "bg-lime-500/15 text-lime-700 dark:text-lime-400", dot: "bg-lime-500" },
  cardio: { icon: Bike, label: "Bici e altro", tile: "bg-sky-500/15 text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
};

/** Il dato più parlante: km per corsa e bici, tonnellaggio per la palestra, altrimenti la durata */
export function activityMetric(item: ActivityItem): string {
  if (item.kind !== "gym" && item.distance > 0) return `${formatKm(item.distance)} km`;
  if (item.kind === "gym" && item.volume > 0) return formatVolume(item.volume);
  return formatHours(item.duration);
}
