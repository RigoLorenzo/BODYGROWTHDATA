"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, X, Activity, Info, AlertTriangle, Scale } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { analyzeBodyComposition } from "@/lib/body-composition";
import { useUIStore } from "@/store/ui-store";

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

const EXP_LABELS: Record<string, string> = {
  BEGINNER: "Principiante",
  INTERMEDIATE: "Intermedio",
  ADVANCED: "Avanzato",
  ELITE: "Elite",
};

export function BodyStatsCard() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const setMeasurementFormOpen = useUIStore((s) => s.setMeasurementFormOpen);
  const [form, setForm] = useState({ height: "", experienceLevel: "" });

  const { data: profile } = useQuery<Profile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return {};
      return res.json();
    },
  });

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

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Dati Fisici
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={handleOpen}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Modifica
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {weight || height ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {height && (
                  <div className="text-center p-3 rounded-xl bg-muted/30">
                    <p className="text-xl font-bold tabular-nums">{height}<span className="text-sm font-normal text-muted-foreground">cm</span></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Altezza</p>
                  </div>
                )}
                {weight && (
                  <button
                    onClick={() => setMeasurementFormOpen(true)}
                    className="text-center p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-xl font-bold tabular-nums">{weight}<span className="text-sm font-normal text-muted-foreground">kg</span></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Peso</p>
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                      {latestMeasurement?.weight
                        ? `da misurazione ${format(new Date(latestMeasurement.date), "d MMM", { locale: it })}`
                        : "tocca per aggiornare"}
                    </p>
                  </button>
                )}
              </div>

              {bmi && hp !== null && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-3 rounded-xl bg-muted/30">
                    <p className={`text-xl font-bold tabular-nums ${bmiCategory?.color}`}>
                      {bmi.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">BMI</p>
                    <p className={`text-[9px] mt-0.5 ${bmiCategory?.color}`}>{bmiCategory?.label}</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/30">
                    <p className={`text-xl font-bold tabular-nums ${hp >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {hp > 0 ? "+" : ""}{hp.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">HP</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">peso−(alt−100)</p>
                  </div>
                </div>
              )}

              {/* Dati aggiuntivi: compaiono solo se disponibili */}
              {(analysis.ffmiNormalized || analysis.waistToHeight) && (
                <div className="grid grid-cols-2 gap-2">
                  {analysis.ffmiNormalized && (
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <p className="text-xl font-bold tabular-nums">{analysis.ffmiNormalized.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">FFMI</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        massa magra {analysis.leanMassKg?.toFixed(1)}kg
                      </p>
                    </div>
                  )}
                  {analysis.waistToHeight && (
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <p
                        className={`text-xl font-bold tabular-nums ${
                          analysis.waistToHeight < 0.5 ? "text-green-400" : analysis.waistToHeight < 0.55 ? "text-yellow-400" : "text-red-400"
                        }`}
                      >
                        {analysis.waistToHeight.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Vita / Altezza</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">riferimento &lt; 0.50</p>
                    </div>
                  )}
                </div>
              )}

              {/* Lettura del BMI: il valore standard non cambia mai */}
              {analysis.reading && analysis.reading.key !== "STANDARD" && (
                <div
                  className={`rounded-xl border p-3 ${
                    analysis.reading.tone === "info"
                      ? "bg-blue-400/10 border-blue-400/20"
                      : analysis.reading.tone === "warning"
                        ? "bg-yellow-400/10 border-yellow-400/20"
                        : "bg-muted/30 border-border/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 shrink-0 ${
                        analysis.reading.tone === "info"
                          ? "text-blue-400"
                          : analysis.reading.tone === "warning"
                            ? "text-yellow-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {analysis.reading.tone === "warning" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-snug">{analysis.reading.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                        {analysis.reading.body}
                      </p>
                      {analysis.trendNote && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
                          {analysis.trendNote}
                        </p>
                      )}
                      {analysis.missingSignals.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                          Per una lettura più precisa puoi aggiungere {analysis.missingSignals.join(" o ")} in
                          Misurazioni Corporee (facoltativo).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {profile?.experienceLevel && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">Livello</p>
                  <p className="text-xs font-semibold">{EXP_LABELS[profile.experienceLevel] ?? profile.experienceLevel}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Nessun dato fisico inserito</p>
              <div className="flex flex-col gap-2 items-center">
                <Button size="sm" variant="outline" onClick={handleOpen}>Inserisci altezza</Button>
                <Button size="sm" variant="ghost" onClick={() => setMeasurementFormOpen(true)}>
                  <Scale className="h-3.5 w-3.5 mr-1.5" />
                  Registra il peso
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl p-6 shadow-xl max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Modifica Dati Fisici</h2>
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
