import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FitnessTabs } from "@/components/analytics/fitness-tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Fitness" };

/** Sezioni spostate altrove: i vecchi link portano alla pagina giusta */
const MOVED: Record<string, string> = {
  calendario: "/history",
  storico: "/history",
};

export default async function FitnessPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; tab?: string }>;
}) {
  const { area, tab } = await searchParams;
  // Benessere aveva un'area qui
  if (area === "benessere") redirect(tab ? `/wellness?tab=${encodeURIComponent(tab)}` : "/wellness");
  if (tab && MOVED[tab]) redirect(MOVED[tab]);

  return (
    <div className="container mx-auto max-w-xl space-y-1 px-4 pb-6 pt-3">
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Fitness</h1>
      {/* useSearchParams (scheda e periodo scelti) richiede un confine Suspense */}
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <FitnessTabs />
      </Suspense>
    </div>
  );
}
