"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, X, Info, AlertTriangle, Scale } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { analyzeBodyComposition } from "@/lib/body-composition";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { formatDecimal } from "@/components/analytics/format";
import { EmptyState, Section, Stat } from "@/components/analytics/ui";
import { useUserProfile } from "./profile-hero";

interface Profile {
  height?: number | null;
  weight?: number | null;
  experienceLevel?: string;
}

/** Misurazione corporea: stessa fonte della sezione "Misurazioni Corporee" */
interface Measurement {
  id: string;
  date: string;
  weight?: number | null;
  bodyFat?: number | null;
  muscleMass?: number | null;
  waist?: number | null;
}

export function BodyStatsCard() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const setMeasurementFormOpen = useUIStore((s) => s.setMeasurementFormOpen);
  const [form, setForm] = useState({ height: "", experienceLevel: "" });

  const { data: profile } = useUserProfile();

  // Stessa query (e quindi stessa cache) della sezione Misurazioni Corporee
  const { data: measurements } = useQuery<Measurement[]>({
    queryKey: ["measurements"],
    queryFn: async () => {
      const res = await fetch("/api/measurements");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const latestMeasurement = measurements?.[0];
  const previousMeasurement = measurements?.[1];

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Profile & { experienceLevel: string }>) => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Profilo aggiornato!" });
      setEditing(false);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare il profilo", variant: "destructive" });
    },
  });

  const handleOpen = () => {
    setForm({
      height: profile?.height?.toString() ?? "",
      experienceLevel: profile?.experienceLevel ?? "BEGINNER",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    if (form.height) payload.height = parseFloat(form.height);
    if (form.experienceLevel) payload.experienceLevel = form.experienceLevel;
    updateMutation.mutate(payload);
  };

  // Unica fonte del peso: l'ultima misurazione (il profilo la rispecchia)
  const weight = latestMeasurement?.weight ?? profile?.weight ?? null;
  const height = profile?.height;
  const hp = weight && height ? weight - (height - 100) : null;

  // Interpretazione basata sui dati già presenti: profilo + ultime misurazioni
  const analysis = analyzeBodyComposition({
    heightCm: height,
    weightKg: weight,
    bodyFatPercent: latestMeasurement?.bodyFat,
    muscleMassKg: latestMeasurement?.muscleMass,
    waistCm: latestMeasurement?.waist,
    previous: previousMeasurement
      ? {
          date: previousMeasurement.date,
          weightKg: previousMeasurement.weight,
          bodyFatPercent: previousMeasurement.bodyFat,
          muscleMassKg: previousMeasurement.muscleMass,
        }
      : null,
  });
  const bmi = analysis.bmi;
  const bmiCategory = analysis.bmiCategory;

  const updated = latestMeasurement?.weight ? format(new Date(latestMeasurement.date), "d MMM", { locale: it }) : null;
  const tone = analysis.reading?.tone;

  return (
    <>
      <Section
        title="Corpo"
        hint={updated ? `Peso dalla misurazione del ${updated}` : "Altezza dal profilo, peso dalle misure"}
        action={
          <button
            type="button"
            onClick={handleOpen}
            className="flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium active:bg-muted/70"
          >
            <Pencil className="h-3.5 w-3.5" /> Modifica
          </button>
        }
      >
        {weight || height ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-x-3 gap-y-4">
              <Stat label="Peso" value={weight ? formatDecimal(weight) : "—"} unit={weight ? "kg" : undefined} />
              <Stat label="Altezza" value={height ?? "—"} unit={height ? "cm" : undefined} />
              {bmi != null && (
                <Stat
                  label="BMI"
                  value={<span className={bmiCategory?.color}>{formatDecimal(bmi)}</span>}
                  detail={bmiCategory?.label}
                />
              )}
              {hp !== null && <Stat label="HP" value={`${hp > 0 ? "+" : ""}${formatDecimal(hp)}`} unit="kg" detail="su altezza − 100" />}
              {analysis.ffmiNormalized && (
                <Stat
                  label="FFMI"
                  value={formatDecimal(analysis.ffmiNormalized)}
                  detail={`magra ${formatDecimal(analysis.leanMassKg ?? 0)} kg`}
                />
              )}
              {analysis.waistToHeight && (
                <Stat
                  label="Vita/alt."
                  value={formatDecimal(analysis.waistToHeight, 2)}
                  detail={analysis.waistToHeight < 0.5 ? "sotto 0,50: ok" : "riferimento < 0,50"}
                />
              )}
            </div>

            {/* Lettura del BMI: il valore standard non cambia mai */}
            {analysis.reading && analysis.reading.key !== "STANDARD" && (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-2xl p-4",
                  tone === "info" ? "bg-sky-500/10" : tone === "warning" ? "bg-amber-500/10" : "bg-muted/60"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0",
                    tone === "info" ? "text-sky-700 dark:text-sky-400" : tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                  )}
                >
                  {tone === "warning" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </span>
                <div className="min-w-0 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                  <p className="text-sm font-semibold leading-snug text-foreground">{analysis.reading.title}</p>
                  <p>{analysis.reading.body}</p>
                  {analysis.trendNote && <p>{analysis.trendNote}</p>}
                  {analysis.missingSignals.length > 0 && (
                    <p className="text-[11px]">
                      Per una lettura più precisa aggiungi {analysis.missingSignals.join(" o ")} nelle misure (facoltativo).
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMeasurementFormOpen(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border/60 text-sm font-medium active:bg-muted/50"
            >
              <Scale className="h-4 w-4" /> Registra il peso
            </button>
          </div>
        ) : (
          <EmptyState>
            <span className="block">Inserisci altezza e peso per BMI, HP e composizione corporea.</span>
            <span className="mt-3 flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={handleOpen}>
                Inserisci altezza
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMeasurementFormOpen(true)}>
                <Scale className="mr-1.5 h-3.5 w-3.5" /> Registra il peso
              </Button>
            </span>
          </EmptyState>
        )}
      </Section>

      <AnimatePresence>
        {editing && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setEditing(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">Modifica dati fisici</h2>
                <button onClick={() => setEditing(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Altezza (cm)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="175"
                    value={form.height}
                    onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                  />
                </div>

                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs font-medium">Peso</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Si aggiorna registrando una misurazione, così Dati Fisici e Misurazioni Corporee
                    non possono discordare.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setEditing(false);
                      setMeasurementFormOpen(true);
                    }}
                  >
                    <Scale className="h-3.5 w-3.5 mr-1.5" />
                    Registra misurazione
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Livello di esperienza</Label>
                  <Select value={form.experienceLevel} onValueChange={(v) => setForm((f) => ({ ...f, experienceLevel: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona livello" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BEGINNER">Principiante</SelectItem>
                      <SelectItem value="INTERMEDIATE">Intermedio</SelectItem>
                      <SelectItem value="ADVANCED">Avanzato</SelectItem>
                      <SelectItem value="ELITE">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
