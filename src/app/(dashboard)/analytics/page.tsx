import { Suspense } from "react";
import { AnalyticsArea } from "@/components/analytics/analytics-area";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto max-w-xl space-y-3 px-4 pb-6 pt-3">
      {/* useSearchParams (area e scheda scelte) richiede un confine Suspense */}
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <AnalyticsArea />
      </Suspense>
    </div>
  );
}
