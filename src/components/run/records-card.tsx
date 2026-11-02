import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronRight, Trophy } from "lucide-react";
import { Section } from "@/components/analytics/ui";
import { formatDuration, formatKm, formatPace, paceSecondsPerKm } from "@/lib/run/format";
import type { RunStats } from "./types";

/** Migliori tempi sulle distanze standard, corsa più lunga e ritmo migliore */
export function RecordsCard({ stats }: { stats: RunStats }) {
  const { records, longest, fastest } = stats;
  if (!records.length && !longest) return null;

  return (
    <Section title="Record">
      <ul className="-my-3">
        {records.map((r) => (
          <Row
            key={r.name}
            href={`/run/${r.runId}`}
            label={r.name}
            value={formatDuration(r.seconds)}
            hint={`${formatPace(paceSecondsPerKm(r.distance, r.seconds))}/km · ${format(new Date(r.date), "d MMM yy", { locale: it })}`}
          />
        ))}
        {longest && (
          <Row
            href={`/run/${longest.id}`}
            label="Corsa più lunga"
            value={`${formatKm(longest.distance)} km`}
            hint={format(new Date(longest.startedAt), "d MMM yy", { locale: it })}
          />
        )}
        {fastest && (
          <Row
            href={`/run/${fastest.id}`}
            label="Ritmo migliore (≥ 3 km)"
            value={`${formatPace(paceSecondsPerKm(fastest.distance, fastest.movingTime))}/km`}
            hint={`${formatKm(fastest.distance)} km · ${format(new Date(fastest.startedAt), "d MMM yy", { locale: it })}`}
          />
        )}
      </ul>
    </Section>
  );
}

function Row({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <li className="border-b border-border/50 last:border-0">
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 active:bg-muted/50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Trophy className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-xs tabular-nums text-muted-foreground">{hint}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-bold tabular-nums">{value}</p>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
