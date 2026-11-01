"use client";

import { Bike, CalendarDays, Watch } from "lucide-react";
import { formatKm } from "@/lib/run/format";
import { cn } from "@/lib/utils";
import { formatNumberIt, formatShareDuration } from "@/lib/workout-share";

/** Tipi importati dagli orologi → nome italiano */
const SPORT_LABEL: Record<string, string> = {
  Ride: "Bici",
  IndoorRide: "Bici indoor",
  Walk: "Camminata",
  Hike: "Escursione",
  Swim: "Nuoto",
  Row: "Vogatore",
  Elliptical: "Ellittica",
  StairStepper: "Scale",
  Yoga: "Yoga",
  Pilates: "Pilates",
  Workout: "Allenamento",
};

export const SOURCE_NAME: Record<string, string> = { GARMIN: "Garmin", MI_FITNESS: "Mi Fitness", STRAVA: "Strava" };

export interface ImportedActivity {
  startedAt: Date | string;
  duration: number | null;
  title: string | null;
  sportType: string | null;
  source: string | null;
  distance: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  estimatedCalories: number | null;
}

const slabStyle: React.CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 100% 0%, rgba(56,189,248,0.22) 0%, transparent 45%)",
    "radial-gradient(circle at 0% 100%, rgba(212,255,58,0.12) 0%, transparent 50%)",
  ].join(","),
};

/** Bici, camminata, nuoto… importati dall'orologio: distanza, tempo e battiti */
export function ImportedActivityCard({ activity }: { activity: ImportedActivity }) {
  const started = new Date(activity.startedAt);
  const sport = SPORT_LABEL[activity.sportType ?? ""] ?? "Attività";
  const seconds = activity.duration ?? 0;
  const km = activity.distance && activity.distance > 0 ? activity.distance / 1000 : null;
  const speed = km && seconds > 0 ? (km / seconds) * 3600 : null;

  const stats = [
    { label: "Durata", value: seconds ? formatShareDuration(seconds) : "—" },
    { label: "Velocità", value: speed ? formatNumberIt(speed, 1) : "—", unit: speed ? "km/h" : undefined },
    { label: "FC media", value: activity.avgHeartRate ? String(Math.round(activity.avgHeartRate)) : "—", unit: activity.avgHeartRate ? "bpm" : undefined },
    { label: "Calorie", value: activity.estimatedCalories ? formatNumberIt(activity.estimatedCalories) : "—", unit: activity.estimatedCalories ? "kcal" : undefined },
  ].filter((s) => s.label !== "Velocità" || speed);

  return (
    <section
      aria-label="Riepilogo attività"
      className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-zinc-50 ring-1 ring-white/10"
      style={slabStyle}
    >
      <p suppressHydrationWarning className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate">{started.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</span>
        <span className="text-zinc-500">· {started.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
      </p>
      <h2 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.9]">{activity.title ?? sport}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1 rounded-full bg-sky-400/15 px-2.5 py-1 text-sky-300">
          <Bike className="h-3.5 w-3.5" aria-hidden /> {sport}
        </span>
        {activity.source && (
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-zinc-300">
            <Watch className="h-3.5 w-3.5" aria-hidden /> da {SOURCE_NAME[activity.source] ?? "smartwatch"}
          </span>
        )}
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{km ? "Distanza" : "Durata"}</p>
        <p className="mt-1 flex items-end gap-1.5 font-display font-extrabold leading-[0.85]">
          <span className="text-[5.5rem] tabular-nums tracking-tight text-sky-300">
            {km ? formatKm(activity.distance!) : formatShareDuration(seconds || 60)}
          </span>
          {km && <span className="pb-2 text-4xl font-bold">km</span>}
        </p>
      </div>

      <dl className={cn("mt-5 grid border-y border-white/10 py-3", stats.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {stats.map((item, i) => (
          <div key={item.label} className={cn("min-w-0", i > 0 && "border-l border-white/10 pl-3")}>
            <dd className="truncate font-display text-2xl font-bold leading-none tabular-nums">
              {item.value}
              {item.unit && <span className="ml-0.5 text-xs font-semibold text-zinc-500">{item.unit}</span>}
            </dd>
            <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{item.label}</dt>
          </div>
        ))}
      </dl>
      {activity.maxHeartRate && (
        <p className="mt-3 text-xs text-zinc-400">FC massima {Math.round(activity.maxHeartRate)} bpm</p>
      )}
    </section>
  );
}
