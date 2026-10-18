import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RunOverview } from "@/components/run/run-overview";

export const metadata = { title: "Corsa" };

export default function RunPage() {
  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Corsa</h1>
        <Link
          href="/run/new"
          aria-label="Aggiungi corsa"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </div>
      {/* useSearchParams (esito del collegamento Strava) richiede un confine Suspense */}
      <Suspense>
        <RunOverview />
      </Suspense>
    </div>
  );
}
