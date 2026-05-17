"use client";

import { Suspense } from "react";
import { CalendarHeatmap } from "@/components/calendar/calendar-heatmap";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { WorkoutHistoryList } from "@/components/calendar/workout-history-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarPage() {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario</h1>
        <p className="text-muted-foreground text-sm">La tua storia di allenamento</p>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="storico">Storico</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="space-y-6 mt-4">
          <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
            <CalendarHeatmap />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <CalendarMonthView />
          </Suspense>
        </TabsContent>

        <TabsContent value="storico" className="mt-4">
          <WorkoutHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
