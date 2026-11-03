import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarRange, Dumbbell, Footprints, Medal, Trophy, type LucideIcon } from "lucide-react";
import { records, type ActivityItem, type Period } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { formatVolume } from "@/lib/utils";
import { formatHours } from "./format";
import type { RecordItem } from "./record-list";
import { activityHref } from "./use-activity";

interface Best {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href?: string;
}

/** Con meno sedute "il meglio" sarebbe solo l'elenco degli allenamenti */
const MIN_SESSIONS = 3;

const plural = (n: number) => `${n} ${n === 1 ? "allenamento" : "allenamenti"}`;
const shortDate = (d: Date) => format(d, "d MMM yyyy", { locale: it });

/**
 * I risultati migliori dentro il periodo: con "Sempre" diventano i record di
 * tutti i tempi. Al massimo quattro righe, ognuna apre il dettaglio.
 */
function bestOf(items: ActivityItem[], period: Period): Best[] {
  const r = records(items);
  const list: Best[] = [];
  if (period !== "week" && r.bestWeekSessions)
    list.push({
      icon: Trophy,
      label: "Settimana migliore",
      value: plural(r.bestWeekSessions.sessions),
      detail: `dal ${format(r.bestWeekSessions.start, "d MMM", { locale: it })} · ${formatHours(r.bestWeekSessions.duration)}`,
    });
  if ((period === "year" || period === "all") && r.bestMonth)
    list.push({
      icon: CalendarRange,
      label: "Mese migliore",
      value: format(r.bestMonth.start, "MMMM yyyy", { locale: it }),
      detail: plural(r.bestMonth.sessions),
    });
  if (r.heaviestSession)
    list.push({
      icon: Dumbbell,
      label: "Seduta più pesante",
      value: formatVolume(r.heaviestSession.volume),
      detail: `${r.heaviestSession.title} · ${shortDate(r.heaviestSession.startedAt)}`,
      href: activityHref(r.heaviestSession),
    });
  if (r.longestRun)
    list.push({
      icon: Footprints,
      label: "Corsa più lunga",
      value: `${formatKm(r.longestRun.distance)} km`,
      detail: shortDate(r.longestRun.startedAt),
      href: activityHref(r.longestRun),
    });
  // Mai la stessa seduta due volte
  if (list.length < 4 && r.longestSession && r.longestSession.id !== r.heaviestSession?.id)
    list.push({
      icon: Medal,
      label: "Allenamento più lungo",
      value: formatHours(r.longestSession.duration),
      detail: `${r.longestSession.title} · ${shortDate(r.longestSession.startedAt)}`,
      href: activityHref(r.longestSession),
    });
  return list.slice(0, 4);
}

/** Il meglio del periodo (con "Sempre": i record di sempre); niente se le sedute sono poche */
export function bestOfPeriod(items: ActivityItem[], period: Period): RecordItem[] {
  if (items.length < MIN_SESSIONS) return [];
  return bestOf(items, period).map((b) => ({ ...b, key: b.label }));
}
