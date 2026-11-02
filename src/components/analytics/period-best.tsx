import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarRange, ChevronRight, Dumbbell, Footprints, Medal, Trophy, type LucideIcon } from "lucide-react";
import { records, type ActivityItem, type Period } from "@/lib/insights";
import { formatKm } from "@/lib/run/format";
import { formatVolume } from "@/lib/utils";
import { formatHours } from "./format";
import { Section } from "./ui";
import { activityHref } from "./use-activity";

interface Best {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href?: string;
}

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

function Row({ item }: { item: Best }) {
  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <item.icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
      </span>
      <span className="shrink-0 font-display text-lg font-bold tabular-nums first-letter:uppercase">{item.value}</span>
      {item.href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const className = "flex items-center gap-3 py-3";
  return (
    <li className="border-b border-border/50 last:border-0">
      {item.href ? (
        <Link href={item.href} className={`${className} -mx-2 rounded-xl px-2 active:bg-muted/50`}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

/** Con meno sedute "il meglio" sarebbe solo l'elenco degli allenamenti */
const MIN_SESSIONS = 3;

export function PeriodBest({ items, period }: { items: ActivityItem[]; period: Period }) {
  if (items.length < MIN_SESSIONS) return null;
  const list = bestOf(items, period);
  if (!list.length) return null;
  return (
    <Section
      title={period === "all" ? "Record" : "Il meglio"}
      action={
        <Link href="/records" className="-mr-2 flex h-9 shrink-0 items-center gap-0.5 px-2 text-xs font-medium text-muted-foreground active:text-foreground">
          Per esercizio <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <ul className="-my-3">
        {list.map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </ul>
    </Section>
  );
}
