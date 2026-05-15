import { Suspense } from "react";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">Performance & progressi</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <AnalyticsTabs />
      </Suspense>
    </div>
  );
}
