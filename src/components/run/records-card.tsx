import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Gauge, Route, Trophy } from "lucide-react";
import { RecordList, type RecordItem } from "@/components/analytics/record-list";
import { Block } from "@/components/analytics/ui";
import { formatDuration, formatKm, formatPace, paceSecondsPerKm } from "@/lib/run/format";
import type { RunStats } from "./types";

const day = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: it });

/** Record di sempre: tempi sulle distanze standard, corsa più lunga e ritmo migliore */
export function RecordsCard({ stats }: { stats: RunStats }) {
  const { records, longest, fastest } = stats;
  if (!records.length && !longest) return null;

  const items: RecordItem[] = [
    ...records.map((r) => ({
      key: r.name,
      icon: Trophy,
      label: r.name,
      value: formatDuration(r.seconds),
      detail: `${formatPace(paceSecondsPerKm(r.distance, r.seconds))} al km · ${day(r.date)}`,
      href: `/run/${r.runId}`,
    })),
    ...(longest
      ? [{ key: "longest", icon: Route, label: "Corsa più lunga", value: `${formatKm(longest.distance)} km`, detail: day(longest.startedAt), href: `/run/${longest.id}` }]
      : []),
    ...(fastest
      ? [
          {
            key: "fastest",
            icon: Gauge,
            label: "Ritmo migliore",
            value: formatPace(paceSecondsPerKm(fastest.distance, fastest.movingTime)),
            detail: `${formatKm(fastest.distance)} km · ${day(fastest.startedAt)}`,
            href: `/run/${fastest.id}`,
          },
        ]
      : []),
  ];

  return (
    <Block title="Record di sempre">
      <RecordList items={items} />
    </Block>
  );
}
