"use client";

import { useHeatmapData } from "@/hooks/use-workout-session";
import { Card, CardContent } from "@/components/ui/card";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function WeeklyHeatmap() {
  const year = new Date().getFullYear();
  const { data: heatmap } = useHeatmapData(year);

  const today = new Date();
  const days = eachDayOfInterval({ start: subDays(today, 6), end: today });

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-1">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const hasWorkout = !!(heatmap as any)?.[dateStr];
            const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

            return (
              <div key={dateStr} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-[10px] text-muted-foreground">
                  {format(day, "EEE", { locale: it }).charAt(0).toUpperCase()}
                </span>
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium",
                    hasWorkout
                      ? "bg-green-600 text-white"
                      : isToday
                      ? "bg-muted border-2 border-primary text-foreground"
                      : "bg-muted/30 text-muted-foreground"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
