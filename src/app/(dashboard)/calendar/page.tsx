import { Suspense } from "react";
import { CalendarHeatmap } from "@/components/calendar/calendar-heatmap";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Calendario" };

export default function CalendarPage() {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground text-sm">La tua storia di allenamento</p>
      </div>

      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <CalendarHeatmap />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <CalendarMonthView />
      </Suspense>
    </div>
  );
}
