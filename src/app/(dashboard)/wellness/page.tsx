import { Suspense } from "react";
import { WellnessTabs } from "@/components/wellness/wellness-tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Benessere" };

export default function WellnessPage() {
  return (
    <div className="container mx-auto max-w-xl space-y-3 px-4 pb-6 pt-3">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Benessere</h1>
        <p className="text-sm text-muted-foreground">Battiti, sonno e recupero dallo smartwatch</p>
      </div>
      {/* useSearchParams (scheda scelta) richiede un confine Suspense */}
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <WellnessTabs />
      </Suspense>
    </div>
  );
}
