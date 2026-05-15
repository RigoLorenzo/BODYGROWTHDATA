"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function StrengthChart() {
  const [exerciseId, setExerciseId] = useState("seed-barbell-bench-press");

  const { data, isLoading } = useQuery({
    queryKey: ["strength-history", exerciseId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/exercise/${exerciseId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!exerciseId,
  });

  const exercises = [
    { id: "seed-barbell-bench-press", name: "Panca Piana" },
    { id: "seed-barbell-back-squat", name: "Squat" },
    { id: "seed-deadlift", name: "Stacco" },
    { id: "seed-overhead-press", name: "Overhead Press" },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Progressione Forza</CardTitle>
          <Select value={exerciseId} onValueChange={setExerciseId}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}kg`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="maxWeight" stroke="#3b82f6" strokeWidth={2} dot={false} name="Peso Max" />
              <Line type="monotone" dataKey="oneRM" stroke="#8b5cf6" strokeWidth={2} dot={false} strokeDasharray="4 2" name="1RM Est." />
            </LineChart>
          </ResponsiveContainer>
        )}
        {(!data || data.length === 0) && !isLoading && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nessun dato disponibile per questo esercizio
          </div>
        )}
      </CardContent>
    </Card>
  );
}
