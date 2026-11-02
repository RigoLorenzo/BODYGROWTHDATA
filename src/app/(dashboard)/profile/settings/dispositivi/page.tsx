import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DevicesSection } from "@/components/devices/devices-section";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Dispositivi" };

/** Smartwatch e app collegate: dalle impostazioni */
export default function DevicesPage() {
  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/profile/settings"
          aria-label="Torna alle impostazioni"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Dispositivi</h1>
      </div>
      {/* useSearchParams (esito Strava, ricollegamento) richiede un confine Suspense */}
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <DevicesSection />
      </Suspense>
    </div>
  );
}
