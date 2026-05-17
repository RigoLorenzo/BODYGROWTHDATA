"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Scale, X } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

interface MeasurementForm {
  weight: string;
  bodyFat: string;
  muscleMass: string;
}

export function BodyMeasurements() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MeasurementForm>({ weight: "", bodyFat: "", muscleMass: "" });

  const { data, isLoading } = useQuery({
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
      setForm({ weight: "", bodyFat: "", muscleMass: "" });
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
    if (Object.keys(payload).length === 0) return;
    addMutation.mutate(payload);
  };

  const latest = data?.[0];

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

                <Button
                  className="w-full mt-2"
                  onClick={handleSubmit}
                  disabled={addMutation.isPending || (!form.weight && !form.bodyFat && !form.muscleMass)}
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
