"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, X, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

interface Profile {
  height?: number | null;
  weight?: number | null;
  experienceLevel?: string;
}

function getBMICategory(bmi: number) {
  if (bmi < 18.5) return { label: "Sottopeso", color: "text-blue-400" };
  if (bmi < 25) return { label: "Normopeso", color: "text-green-400" };
  if (bmi < 30) return { label: "Sovrappeso", color: "text-yellow-400" };
  return { label: "Obesità", color: "text-red-400" };
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
  const [form, setForm] = useState({ height: "", weight: "", experienceLevel: "" });

  const { data: profile } = useQuery<Profile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return {};
      return res.json();
    },
  });

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
      weight: profile?.weight?.toString() ?? "",
      experienceLevel: profile?.experienceLevel ?? "BEGINNER",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    if (form.height) payload.height = parseFloat(form.height);
    if (form.weight) payload.weight = parseFloat(form.weight);
    if (form.experienceLevel) payload.experienceLevel = form.experienceLevel;
    updateMutation.mutate(payload);
  };

  const weight = profile?.weight;
  const height = profile?.height;
  const bmi = weight && height ? weight / Math.pow(height / 100, 2) : null;
  const hp = weight && height ? weight - (height - 100) : null;
  const bmiCategory = bmi ? getBMICategory(bmi) : null;

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
                  <div className="text-center p-3 rounded-xl bg-muted/30">
                    <p className="text-xl font-bold tabular-nums">{weight}<span className="text-sm font-normal text-muted-foreground">kg</span></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Peso</p>
                  </div>
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
              <Button size="sm" variant="outline" onClick={handleOpen}>Inserisci dati</Button>
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
                <div className="grid grid-cols-2 gap-3">
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
                  <div className="space-y-1.5">
                    <Label>Peso (kg)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="75"
                      value={form.weight}
                      onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                    />
                  </div>
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
