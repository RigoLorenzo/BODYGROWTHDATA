"use client";

import { useMemo } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useActivity } from "@/components/analytics/use-activity";
import { useAnalyticsOverview } from "@/hooks/use-workout-session";

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

function HeroStat({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-background/60">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums leading-tight">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-background/60">{unit}</span>}
      </p>
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
  const subtitle = [level, summary.since && `ti alleni da ${summary.since}`].filter(Boolean).join(" · ");

  return (
    <section className="rounded-3xl bg-foreground p-5 text-background">
      <div className="flex items-center gap-4">
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-background/20"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-background/15 font-display text-3xl font-bold uppercase">
            {user.name?.charAt(0) ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-display text-3xl font-bold uppercase leading-none tracking-wide">{user.name ?? "Atleta"}</h2>
          <p className="mt-1 truncate text-sm text-background/70">{subtitle || user.email}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3 border-t border-background/15 pt-4">
        <HeroStat label="Sedute" value={summary.sessions.toLocaleString("it-IT")} />
        <HeroStat label="Streak" value={overview?.streak ?? 0} unit="gg" />
        <HeroStat label="Record" value={records?.length ?? 0} />
        <HeroStat label="Km corsi" value={Math.round(summary.km / 1000).toLocaleString("it-IT")} />
      </div>
    </section>
  );
}
