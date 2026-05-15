"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CalendarMonthView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();

  const { data: heatmap } = useQuery({
    queryKey: ["analytics", "heatmap", year],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?type=heatmap&year=${year}`);
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start: getDay returns 0=Sun, we want 1=Mon
  const startPad = ((getDay(monthStart) + 6) % 7);

  const prev = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const next = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon-sm" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold capitalize">
            {format(currentDate, "MMMM yyyy", { locale: it })}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
            <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayData = (heatmap as any)?.[dateStr];
            const hasWorkout = !!dayData;
            const today = isToday(day);

            return (
              <button
                key={dateStr}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors",
                  hasWorkout
                    ? "bg-green-600/20 text-green-400 font-semibold"
                    : today
                    ? "border border-primary text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{format(day, "d")}</span>
                {hasWorkout && dayData.count > 1 && (
                  <span className="text-[8px] leading-none">{dayData.count}x</span>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
