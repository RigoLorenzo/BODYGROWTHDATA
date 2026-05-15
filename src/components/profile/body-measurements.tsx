"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Scale } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export function BodyMeasurements() {
  const { data, isLoading } = useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const res = await fetch("/api/measurements");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const latest = data?.[0];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Misurazioni Corporee</CardTitle>
          <Button size="sm" variant="ghost">
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : latest ? (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              {format(new Date(latest.date), "d MMM yyyy", { locale: it })}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Peso", value: latest.weight, unit: "kg" },
                { label: "Body Fat", value: latest.bodyFat, unit: "%" },
                { label: "Massa Musc.", value: latest.muscleMass, unit: "kg" },
              ]
                .filter((m) => m.value != null)
                .map((m) => (
                  <div key={m.label} className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-lg font-bold tabular-nums">{m.value}{m.unit}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Scale className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nessuna misurazione registrata</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
