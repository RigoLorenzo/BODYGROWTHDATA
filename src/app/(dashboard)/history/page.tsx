import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HistoryView } from "@/components/calendar/history-view";
import { FITNESS_PATH } from "@/lib/routes";

export const metadata = { title: "Storico" };

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

/** Tutti gli allenamenti, dal più recente: si apre da Riepilogo e Home */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[]; label?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <div className="container mx-auto max-w-xl space-y-4 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href={FITNESS_PATH}
          aria-label="Torna a Fitness"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Storico</h1>
      </div>
      <HistoryView from={first(params.from)} to={first(params.to)} label={first(params.label)?.slice(0, 40)} />
    </div>
  );
}
