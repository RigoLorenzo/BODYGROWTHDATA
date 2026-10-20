import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  CalendarDays,
  CalendarRange,
  Clock,
  Dumbbell,
  Footprints,
  Layers,
  Medal,
  Sunrise,
  Timer,
  Trophy,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { records, type ActivityItem } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { cn, formatVolume } from "@/lib/utils";
import { formatHours } from "./format";
import { activityHref } from "./use-activity";

interface Highlight {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: string;
  detail: string;
  href?: string;
}

const shortDate = (d: Date) => format(d, "d MMM yyyy", { locale: it });
const weekLabel = (d: Date) => `settimana del ${format(d, "d MMM yyyy", { locale: it })}`;

/** I migliori risultati: settimane, mese e sedute da record */
export function recordHighlights(items: ActivityItem[]): Highlight[] {
  const r = records(items);
  const list: Highlight[] = [];
  if (r.bestWeekSessions)
    list.push({
      icon: Trophy,
      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
      label: "Settimana record",
      value: `${r.bestWeekSessions.sessions} allenamenti`,
      detail: weekLabel(r.bestWeekSessions.start),
    });
  if (r.bestWeekDuration)
    list.push({
      icon: Timer,
      tone: "text-orange-600 dark:text-orange-400 bg-orange-500/10",
      label: "Settimana più lunga",
      value: formatHours(r.bestWeekDuration.duration),
      detail: weekLabel(r.bestWeekDuration.start),
    });
  if (r.bestWeekVolume)
    list.push({
      icon: Weight,
      tone: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
      label: "Settimana più pesante",
      value: formatVolume(r.bestWeekVolume.volume),
      detail: weekLabel(r.bestWeekVolume.start),
    });
  if (r.bestMonth)
    list.push({
      icon: CalendarRange,
      tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      label: "Mese migliore",
      value: format(r.bestMonth.start, "MMMM yyyy", { locale: it }),
      detail: `${r.bestMonth.sessions} allenamenti · ${formatHours(r.bestMonth.duration)}`,
    });
  if (r.longestSession)
    list.push({
      icon: Medal,
      tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
      label: "Allenamento più lungo",
      value: formatHours(r.longestSession.duration),
      detail: `${r.longestSession.title} · ${shortDate(r.longestSession.startedAt)}`,
      href: activityHref(r.longestSession),
    });
  if (r.heaviestSession)
    list.push({
      icon: Dumbbell,
      tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
      label: "Seduta con più volume",
      value: formatVolume(r.heaviestSession.volume),
      detail: `${r.heaviestSession.title} · ${shortDate(r.heaviestSession.startedAt)}`,
      href: activityHref(r.heaviestSession),
    });
  if (r.mostSetsSession)
    list.push({
      icon: Layers,
      tone: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10",
      label: "Più serie in una seduta",
      value: `${r.mostSetsSession.sets} serie`,
      detail: shortDate(r.mostSetsSession.startedAt),
      href: activityHref(r.mostSetsSession),
    });
  if (r.longestRun)
    list.push({
      icon: Footprints,
      tone: "text-lime-700 dark:text-lime-400 bg-lime-500/10",
      label: "Corsa più lunga",
      value: `${formatKm(r.longestRun.distance)} km`,
      detail: shortDate(r.longestRun.startedAt),
      href: activityHref(r.longestRun),
    });
  return list;
}

/** Quando e come ti alleni: giorno, orario e durata abituali */
export function habitHighlights(items: ActivityItem[]): Highlight[] {
  const r = records(items);
  const list: Highlight[] = [];
  if (r.favoriteDay)
    list.push({
      icon: CalendarDays,
      tone: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
      label: "Giorno preferito",
      value: r.favoriteDay.name,
      detail: `${r.favoriteDay.sessions} allenamenti in totale`,
    });
  if (r.longestDay)
    list.push({
      icon: Clock,
      tone: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
      label: "Giorno in cui ti alleni di più",
      value: r.longestDay.name,
      detail: `${formatHours(r.longestDay.avgDuration)} in media`,
    });
  if (r.favoriteSlot)
    list.push({
      icon: Sunrise,
      tone: "text-yellow-700 dark:text-yellow-400 bg-yellow-500/10",
      label: "Orario preferito",
      value: r.favoriteSlot.label,
      detail: `${Math.round((r.favoriteSlot.sessions / items.length) * 100)}% degli allenamenti (${r.favoriteSlot.range})`,
    });
  if (r.avgGymDuration)
    list.push({
      icon: Clock,
      tone: "text-slate-600 dark:text-slate-300 bg-slate-500/10",
      label: "Durata media in palestra",
      value: formatHours(r.avgGymDuration),
      detail: `${r.activeDays} giorni attivi${r.firstDate ? ` dal ${shortDate(r.firstDate)}` : ""}`,
    });
  return list;
}

/** Griglia di schede a due colonne; quelle con una seduta aprono il dettaglio */
export function HighlightGrid({ title, list }: { title?: string; list: Highlight[] }) {
  if (!list.length) return null;
  return (
    <section>
      {title && <h2 className="mb-2 px-1 font-display text-xl font-bold uppercase tracking-wide">{title}</h2>}
      <div className="grid grid-cols-2 gap-3">
        {list.map((h) => {
          const body = (
            <>
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", h.tone)}>
                <h.icon className="h-[18px] w-[18px]" />
              </span>
              <p className="mt-3 text-[11px] font-medium uppercase leading-tight tracking-wider text-muted-foreground">{h.label}</p>
              <p className="mt-0.5 font-display text-xl font-bold leading-tight first-letter:uppercase">{h.value}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{h.detail}</p>
            </>
          );
          const className = "block rounded-3xl border border-border/60 bg-card p-4";
          return h.href ? (
            <Link key={h.label} href={h.href} className={cn(className, "active:bg-muted/50")}>
              {body}
            </Link>
          ) : (
            <div key={h.label} className={className}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const HabitHighlights = ({ items }: { items: ActivityItem[] }) => (
  <HighlightGrid title="Le tue abitudini" list={habitHighlights(items)} />
);
