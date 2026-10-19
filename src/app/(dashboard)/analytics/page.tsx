import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; tab?: string }>;
}) {
  // Benessere aveva un'area qui: i vecchi link portano alla sua pagina
  const { area, tab } = await searchParams;
  if (area === "benessere") redirect(tab ? `/wellness?tab=${encodeURIComponent(tab)}` : "/wellness");

  return (
    <div className="container mx-auto max-w-xl space-y-3 px-4 pb-6 pt-3">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Analytics</h1>
        <p className="text-sm text-muted-foreground">Palestra e corsa, i tuoi numeri</p>
      </div>
      {/* useSearchParams (scheda scelta) richiede un confine Suspense */}
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <AnalyticsTabs />
      </Suspense>
    </div>
  );
}
