"use client";

import { useHeatmapData } from "@/hooks/use-workout-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, eachDayOfInterval, startOfYear, endOfYear, getDay, addDays, subDays, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const DAYS = ["L", "M", "M", "G", "V", "S", "D"];

function getIntensity(volume: number, maxVolume: number): number {
  if (!volume) return 0;
  const ratio = volume / maxVolume;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const intensityClasses = [
  "bg-muted/30",
  "bg-green-900/60",
  "bg-green-700/70",
  "bg-green-500/80",
  "bg-green-400",
];

interface TooltipData {
  date: string;
  volume: number;
  count: number;
  x: number;
  y: number;
}

export function CalendarHeatmap() {
  const year = new Date().getFullYear();
  const { data: heatmap, isLoading } = useHeatmapData(year);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const maxVolume = heatmap
    ? Math.max(...Object.values(heatmap as Record<string, { volume: number }>).map((d) => d.volume))
    : 0;

  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const days = eachDayOfInterval({ start: yearStart, end: yearEnd });

  // Pad to start on Monday
  const firstDayOfWeek = getDay(yearStart) || 7; // 1-7, 1=Mon
  const paddingDays = firstDayOfWeek - 1;

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = Array(paddingDays).fill(null);

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Attività {year}</CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Meno</span>
            {intensityClasses.map((cls, i) => (
              <div key={i} className={cn("h-3 w-3 rounded-sm", cls)} />
            ))}
            <span>Più</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto no-scrollbar">
          <div className="relative" style={{ minWidth: 720 }}>
            {/* Month labels */}
            <div className="flex mb-1 ml-6">
              {MONTHS.map((m, i) => {
                const weeksInMonth = Math.ceil(
                  (new Date(year, i + 1, 0).getDate() + new Date(year, i, 1).getDay() - 1) / 7
                );
                return (
                  <div
                    key={m}
                    className="text-[10px] text-muted-foreground"
                    style={{ width: `${Math.round(weeks.length / 12) * 14}px` }}
                  >
                    {m}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-0.5">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1">
                {DAYS.map((d, i) => (
                  <div key={i} className="h-[13px] text-[9px] text-muted-foreground flex items-center">
                    {i % 2 === 0 ? d : ""}
                  </div>
                ))}
              </div>

              {/* Grid */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="h-[13px] w-[13px]" />;
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayData = (heatmap as any)?.[dateStr];
                    const intensity = dayData ? getIntensity(dayData.volume, maxVolume) : 0;

                    return (
                      <div
                        key={di}
                        className={cn(
                          "h-[13px] w-[13px] rounded-sm cursor-pointer transition-transform hover:scale-125",
                          intensityClasses[intensity]
                        )}
                        onMouseEnter={(e) => {
                          if (dayData) {
                            setTooltip({
                              date: format(day, "d MMM yyyy", { locale: it }),
                              volume: dayData.volume,
                              count: dayData.count,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg p-2 text-xs shadow-lg pointer-events-none"
            style={{ left: tooltip.x + 8, top: tooltip.y - 40 }}
          >
            <p className="font-semibold">{tooltip.date}</p>
            <p className="text-muted-foreground">{tooltip.count} allenament{tooltip.count === 1 ? "o" : "i"}</p>
            <p className="text-muted-foreground">{tooltip.volume.toFixed(0)} kg volume</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
