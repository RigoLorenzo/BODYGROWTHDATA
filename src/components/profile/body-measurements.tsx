"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store";
import { formatDecimal } from "@/components/analytics/format";
import { EmptyState, Section, Segmented, Stat } from "@/components/analytics/ui";
import { TrendLine } from "@/components/wellness/charts";

interface Measurement {
  id: string;
  date: string;
  weight?: number | null;
  bodyFat?: number | null;
  muscleMass?: number | null;
  waist?: number | null;
}

type TrendMetric = "weight" | "bodyFat" | "muscleMass" | "waist";

const METRICS: { value: TrendMetric; label: string; unit: string; digits: number }[] = [
  { value: "weight", label: "Peso", unit: "kg", digits: 1 },
  { value: "bodyFat", label: "Grasso", unit: "%", digits: 1 },
  { value: "muscleMass", label: "Muscoli", unit: "kg", digits: 1 },
  { value: "waist", label: "Vita", unit: "cm", digits: 0 },
];
const HISTORY_ROWS = 5;
const CHART_POINTS = 20;

interface MeasurementForm {
  weight: string;
  bodyFat: string;
  muscleMass: string;
  waist: string;
}

const shortDate = (iso: string) => format(new Date(iso), "d MMM", { locale: it });

/** "75,2 kg · 14% · 82 cm": solo i valori misurati quel giorno */
const rowSummary = (m: Measurement) =>
  METRICS.filter((c) => m[c.value] != null)
    .map((c) => `${formatDecimal(m[c.value]!, c.digits)}${c.unit === "%" ? "%" : ` ${c.unit}`}`)
    .join(" · ");

export function BodyMeasurements() {
  const queryClient = useQueryClient();
  // Il form può essere aperto anche dalla scheda Corpo
  const open = useUIStore((s) => s.measurementFormOpen);
  const setOpen = useUIStore((s) => s.setMeasurementFormOpen);
  const [selected, setSelected] = useState<TrendMetric>("weight");
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

  const measurements = data ?? [];
  // Solo le misure registrate almeno una volta
  const available = METRICS.filter((c) => measurements.some((m) => m[c.value] != null));
  const metric = available.find((c) => c.value === selected) ?? available[0];
  const series = metric
    ? measurements
        .filter((m) => m[metric.value] != null)
        .slice(0, CHART_POINTS)
        .reverse()
    : [];
  const current = series.at(-1);
  const delta = series.length > 1 ? series.at(-1)![metric!.value]! - series[0][metric!.value]! : null;

  return (
    <>
      <Section
        title="Misure"
        hint={measurements[0] ? `Ultima il ${format(new Date(measurements[0].date), "d MMMM yyyy", { locale: it })}` : undefined}
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium active:bg-muted/70"
          >
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </button>
        }
      >
        {isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : !metric || !current ? (
          <EmptyState>Nessuna misurazione: registra peso, grasso, muscoli o vita per seguirne l&apos;andamento.</EmptyState>
        ) : (
          <div className="space-y-4">
            {available.length > 1 && (
              <Segmented value={metric.value} options={available} onChange={setSelected} size="sm" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={metric.label}
                value={formatDecimal(current[metric.value]!, metric.digits)}
                unit={metric.unit}
                detail={`il ${shortDate(current.date)}`}
              />
              {delta != null && (
                <Stat
                  label="Variazione"
                  value={`${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatDecimal(Math.abs(delta), metric.digits)}`}
                  unit={metric.unit}
                  detail={`dal ${shortDate(series[0].date)}`}
                />
              )}
            </div>
            {series.length > 1 && (
              <TrendLine
                points={series.map((m) => ({ key: m.id, label: shortDate(m.date), value: m[metric.value]! }))}
                unit={metric.unit}
                tone="ink"
                digits={metric.digits}
              />
            )}
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Storico</p>
              <ul>
                {measurements.slice(0, HISTORY_ROWS).map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-3 border-t border-border/60 py-2.5 text-sm first:border-t-0">
                    <span className="shrink-0 text-muted-foreground">{shortDate(m.date)}</span>
                    <span className="truncate text-right font-medium tabular-nums">{rowSummary(m)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Section>

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
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">Nuova misurazione</h2>
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
                  <Label>Grasso corporeo (%)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 15.0"
                    value={form.bodyFat}
                    onChange={(e) => setForm((f) => ({ ...f, bodyFat: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Massa muscolare (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 38.0"
                    value={form.muscleMass}
                    onChange={(e) => setForm((f) => ({ ...f, muscleMass: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Circonferenza vita (cm)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="es. 82"
                    value={form.waist}
                    onChange={(e) => setForm((f) => ({ ...f, waist: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Facoltativa: migliora la lettura del BMI nella scheda Corpo.
                  </p>
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={handleSubmit}
                  disabled={addMutation.isPending || (!form.weight && !form.bodyFat && !form.muscleMass && !form.waist)}
                >
                  {addMutation.isPending ? "Salvataggio..." : "Salva misurazione"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
