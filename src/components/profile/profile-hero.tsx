"use client";

import { useMemo } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useActivity } from "@/components/analytics/use-activity";
import { useAnalyticsOverview } from "@/hooks/use-workout-session";
import { cn } from "@/lib/utils";
import { formatNumberIt, splitTonnage } from "@/lib/workout-share";

export const EXPERIENCE_LABELS: Record<string, string> = {
  BEGINNER: "Principiante",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzato",
  ELITE: "Elite",
};

/** Stessa chiave (e cache) della pagina Record */
export const useRecordGroups = () =>
  useQuery<unknown[]>({
    queryKey: ["records"],
    queryFn: async () => {
      const res = await fetch("/api/records");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

export const useUserProfile = () =>
  useQuery<{ height?: number | null; weight?: number | null; experienceLevel?: string }>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return {};
      return res.json();
    },
  });

/* Lastra scura in entrambi i temi, come la home e il riepilogo dell'allenamento */
const slabStyle: React.CSSProperties = {
  backgroundImage: [
    "radial-gradient(120% 80% at 100% 0%, rgba(212,255,58,0.18), transparent 55%)",
    "radial-gradient(90% 70% at 0% 100%, rgba(59,130,246,0.14), transparent 60%)",
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 11px)",
  ].join(","),
};

const LIME = "text-[#d4ff3a]";

function Avatar({ name, image }: { name?: string | null; image?: string | null }) {
  const ring = "h-[72px] w-[72px] shrink-0 rounded-full ring-2 ring-[#d4ff3a] ring-offset-4 ring-offset-zinc-950";
  if (image) return <Image src={image} alt="" width={72} height={72} className={cn(ring, "object-cover")} />;
  return (
    <div className={cn(ring, "flex items-center justify-center bg-zinc-800 font-display text-4xl font-extrabold uppercase")}>
      {name?.charAt(0) ?? "?"}
    </div>
  );
}

function Stat({ label, value, unit, first }: { label: string; value: React.ReactNode; unit?: string; first?: boolean }) {
  return (
    <div className={cn("min-w-0", !first && "border-l border-white/10 pl-3")}>
      <dd className="truncate font-display text-[1.7rem] font-bold leading-none tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-zinc-500">{unit}</span>}
      </dd>
      <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
    </div>
  );
}

/** Chi sei e quanto ti sei allenato, a colpo d'occhio */
export function ProfileHero({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const { data: activity = [] } = useActivity();
  const { data: overview } = useAnalyticsOverview();
  const { data: records } = useRecordGroups();
  const { data: profile } = useUserProfile();

  const summary = useMemo(() => {
    const first = activity.reduce<Date | null>((min, a) => (!min || a.startedAt < min ? a.startedAt : min), null);
    return {
      sessions: activity.length,
      km: activity.reduce((s, a) => s + a.distance, 0),
      since: first ? format(first, "MMMM yyyy", { locale: it }) : null,
    };
  }, [activity]);

  const level = profile?.experienceLevel ? EXPERIENCE_LABELS[profile.experienceLevel] : null;
  const lifted = splitTonnage(overview?.total?.volume ?? 0);
  const streak: number = overview?.streak ?? 0;
  const best: number = overview?.longestStreak ?? 0;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-zinc-950 p-5 text-zinc-50 ring-1 ring-white/10" style={slabStyle}>
      <div className="flex items-center gap-4">
        <Avatar name={user.name} image={user.image} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-3xl font-extrabold uppercase leading-none tracking-wide">{user.name ?? "Atleta"}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {level && (
              <span className="rounded-full bg-[#d4ff3a]/15 px-2.5 py-1 font-semibold uppercase tracking-wider text-[#d4ff3a]">{level}</span>
            )}
            <span className="truncate">{summary.since ? `Dal ${summary.since}` : user.email}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Sollevati in totale</p>
          <p className="mt-1 flex items-end gap-1.5 font-display font-extrabold leading-[0.85]">
            <span className={cn("text-7xl tabular-nums tracking-tight", LIME)}>{lifted.value}</span>
            <span className="pb-1.5 text-3xl font-bold">{lifted.unit}</span>
          </p>
        </div>
        <div className="shrink-0 pb-1 text-right">
          <p className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <Flame className={cn("h-3.5 w-3.5", streak > 0 ? LIME : "text-zinc-500")} aria-hidden /> Streak
          </p>
          <p className="mt-1 font-display text-4xl font-extrabold leading-none tabular-nums">
            {streak}
            <span className="ml-1 text-base font-semibold text-zinc-500">gg</span>
          </p>
          {best > 0 && <p className="mt-1 text-xs text-zinc-400">record {best} gg</p>}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-[1.2fr_1fr_1fr] border-t border-white/10 pt-4">
        {/* Il conteggio del server è esatto; l'elenco attività si ferma a 3000 sedute */}
        <Stat first label="Sedute" value={formatNumberIt(overview?.total?.workouts ?? summary.sessions)} />
        <Stat label="Record" value={formatNumberIt(records?.length ?? 0)} />
        <Stat label="Km corsi" value={formatNumberIt(Math.round(summary.km / 1000))} />
      </dl>
    </section>
  );
}
