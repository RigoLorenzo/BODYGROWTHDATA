import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Trophy } from "lucide-react";
import { formatDuration, formatKm, formatPace, paceSecondsPerKm } from "@/lib/run/format";
import type { RunStats } from "./types";

/** Migliori tempi sulle distanze standard, corsa più lunga e ritmo migliore */
export function RecordsCard({ stats }: { stats: RunStats }) {
  const { records, longest, fastest } = stats;
  if (!records.length && !longest) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 font-display text-xl font-bold uppercase tracking-wide">Record</h2>
      <ul className="overflow-hidden rounded-3xl border border-border/60 bg-card">
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
    </section>
  );
}

function Row({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <li className="border-b border-border/50 last:border-0">
      <Link href={href} className="flex items-center gap-3 px-4 py-3 active:bg-muted/50">
        <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{hint}</p>
        </div>
        <p className="shrink-0 font-display text-lg font-bold tabular-nums">{value}</p>
      </Link>
    </li>
  );
}
