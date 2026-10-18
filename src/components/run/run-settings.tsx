"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiError, useInvalidateRuns } from "./queries";
import type { RunStats } from "./types";

const toNumber = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

/** FC massima/a riposo (per il carico) e obiettivo settimanale in km */
export function RunSettings({ settings }: { settings: RunStats["settings"] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    maxHeartRate: settings.maxHeartRate?.toString() ?? "",
    restingHeartRate: settings.restingHeartRate?.toString() ?? "",
    weeklyRunKmGoal: settings.weeklyRunKmGoal?.toString().replace(".", ",") ?? "",
  });
  const invalidate = useInvalidateRuns();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const max = toNumber(form.maxHeartRate);
    const resting = toNumber(form.restingHeartRate);
    setSaving(true);
    try {
      const res = await fetch("/api/runs/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxHeartRate: max == null ? null : Math.round(max),
          restingHeartRate: resting == null ? null : Math.round(resting),
          weeklyRunKmGoal: toNumber(form.weeklyRunKmGoal),
        }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Valori non validi"));
      toast({ title: "Impostazioni salvate" });
      await invalidate();
      setOpen(false);
    } catch (error) {
      toast({ title: "Non salvato", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, inputMode: "numeric" | "decimal") => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="text-xs">
        {label}
      </Label>
      <Input
        id={key}
        inputMode={inputMode}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <section className="rounded-3xl border border-border/60 bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-semibold">Obiettivo e frequenza cardiaca</span>
          <span className="block text-xs text-muted-foreground">
            {settings.weeklyRunKmGoal ? `${settings.weeklyRunKmGoal} km a settimana` : "Nessun obiettivo settimanale"}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <form onSubmit={save} className="space-y-3 border-t border-border/60 px-5 pb-5 pt-4">
          {field("weeklyRunKmGoal", "Obiettivo settimanale (km)", "es. 20", "decimal")}
          <div className="grid grid-cols-2 gap-3">
            {field("maxHeartRate", "FC massima", String(settings.defaults.maxHeartRate), "numeric")}
            {field("restingHeartRate", "FC a riposo", String(settings.defaults.restingHeartRate), "numeric")}
          </div>
          <p className="text-xs text-muted-foreground">
            Le frequenze servono al calcolo di carico, fitness e forma. Vuoto = valori standard.
          </p>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salva
          </Button>
        </form>
      )}
    </section>
  );
}
