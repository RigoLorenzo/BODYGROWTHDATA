"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Scale, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Measurement {
  id: string;
  date: string;
  weight?: number | null;
  bodyFat?: number | null;
  muscleMass?: number | null;
  waist?: number | null;
}

type TrendMetric = "weight" | "bodyFat" | "muscleMass" | "waist";

const METRIC_CONFIG: Record<TrendMetric, { label: string; unit: string; color: string }> = {
  weight: { label: "Peso", unit: "kg", color: "#22c55e" },
  bodyFat: { label: "Body Fat", unit: "%", color: "#f97316" },
  muscleMass: { label: "Massa Musc.", unit: "kg", color: "#3b82f6" },
  waist: { label: "Vita", unit: "cm", color: "#a855f7" },
};

interface MeasurementForm {
  weight: string;
  bodyFat: string;
  muscleMass: string;
  waist: string;
}

export function BodyMeasurements() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("weight");
  const [form, setForm] = useState<MeasurementForm>({ weight: "", bodyFat: "", muscleMass: "", waist: "" });

  const { data, isLoading } = useQuery<Measurement[]>({
    queryKey: ["measurements"],
    queryFn: async () => {
      const res = await fetch("/api/measurements");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: Record<string, number>) => {
      const res = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
      toast({ title: "Misurazione salvata!" });
      setOpen(false);
      setForm({ weight: "", bodyFat: "", muscleMass: "", waist: "" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare la misurazione", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const payload: Record<string, number> = {};
    if (form.weight) payload.weight = parseFloat(form.weight);
    if (form.bodyFat) payload.bodyFat = parseFloat(form.bodyFat);
    if (form.muscleMass) payload.muscleMass = parseFloat(form.muscleMass);
    if (form.waist) payload.waist = parseFloat(form.waist);
    if (Object.keys(payload).length === 0) return;
    addMutation.mutate(payload);
  };

  const latest = data?.[0];
  const cfg = METRIC_CONFIG[trendMetric];

  // Chart: chronological order (oldest first) for the trend
  const chartData = [...(data ?? [])]
    .filter((m) => m[trendMetric] != null)
    .reverse()
    .slice(-15)
    .map((m) => ({
      date: format(new Date(m.date), "d/M", { locale: it }),
      value: m[trendMetric] as number,
    }));

  // Trend direction
  const first = chartData[0]?.value;
  const last = chartData[chartData.length - 1]?.value;
  const trendDelta = first !== undefined && last !== undefined ? last - first : null;

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Misurazioni Corporee</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : latest ? (
            <div className="space-y-4">
              {/* Latest values */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Ultima: {format(new Date(latest.date), "d MMM yyyy", { locale: it })}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["weight", "bodyFat", "muscleMass", "waist"] as TrendMetric[])
                    .filter((k) => latest[k] != null)
                    .map((k) => {
                      const c = METRIC_CONFIG[k];
                      return (
                        <button
                          key={k}
                          onClick={() => setTrendMetric(k)}
                          className={`text-center p-2 rounded-lg transition-colors ${trendMetric === k ? "ring-1 ring-primary" : ""} bg-muted/30`}
                        >
                          <p className="text-lg font-bold tabular-nums">{latest[k]}{c.unit}</p>
                          <p className="text-[10px] text-muted-foreground">{c.label}</p>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Trend chart */}
              {chartData.length > 1 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Andamento {cfg.label}</p>
                    {trendDelta !== null && (
                      <div className="flex items-center gap-1 text-xs">
                        {trendDelta < -0.1 ? (
                          <TrendingDown className="h-3 w-3 text-green-400" />
                        ) : trendDelta > 0.1 ? (
                          <TrendingUp className="h-3 w-3 text-orange-400" />
                        ) : (
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={trendDelta < 0 ? "text-green-400" : trendDelta > 0 ? "text-orange-400" : "text-muted-foreground"}>
                          {trendDelta > 0 ? "+" : ""}{trendDelta.toFixed(1)}{cfg.unit}
                        </span>
                      </div>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis domain={["auto", "auto"]} hide />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number) => [`${v}${cfg.unit}`, cfg.label]}
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                      />
                      <Line dataKey="value" stroke={cfg.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Scale className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna misurazione registrata</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom sheet modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl p-6 shadow-xl max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Nuova Misurazione</h2>
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 75.5"
                    value={form.weight}
                    onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Body Fat (%)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 15.0"
                    value={form.bodyFat}
                    onChange={(e) => setForm((f) => ({ ...f, bodyFat: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Massa Muscolare (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 38.0"
                    value={form.muscleMass}
                    onChange={(e) => setForm((f) => ({ ...f, muscleMass: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Circonferenza Vita (cm)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 82"
                    value={form.waist}
                    onChange={(e) => setForm((f) => ({ ...f, waist: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Facoltativa: migliora l&apos;interpretazione del BMI nei Dati Fisici.
                  </p>
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={handleSubmit}
                  disabled={addMutation.isPending || (!form.weight && !form.bodyFat && !form.muscleMass && !form.waist)}
                >
                  {addMutation.isPending ? "Salvataggio..." : "Salva Misurazione"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
