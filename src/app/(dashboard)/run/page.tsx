import { Suspense } from "react";
import { RunHeader } from "@/components/run/run-header";
import { RunOverview } from "@/components/run/run-overview";

export const metadata = { title: "Corsa" };

export default function RunPage() {
  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <RunHeader />
      {/* useSearchParams (esito del collegamento Strava) richiede un confine Suspense */}
      <Suspense>
        <RunOverview />
      </Suspense>
    </div>
  );
}
