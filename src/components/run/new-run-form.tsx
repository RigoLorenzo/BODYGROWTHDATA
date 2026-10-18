"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatPace, parseDuration } from "@/lib/run/format";
import { cn } from "@/lib/utils";
import { apiError, useInvalidateRuns } from "./queries";

type Mode = "manual" | "gpx";
const toNumber = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);

/** Nuova corsa: inserimento manuale o file GPX */
export function NewRunForm() {
  const [mode, setMode] = useState<Mode>("manual");
  return (
    <div className="space-y-5">
      <div className="flex rounded-xl bg-muted p-1" role="tablist">
        {(
          [
            ["manual", "Manuale"],
            ["gpx", "File GPX"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              "h-10 flex-1 rounded-lg text-sm font-medium transition-colors",
              mode === key ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "manual" ? <ManualForm /> : <GpxForm />}
    </div>
  );
}

function useSaved() {
  const router = useRouter();
  const invalidate = useInvalidateRuns();
  return async (id: string) => {
    await invalidate();
    toast({ title: "Corsa salvata", description: "Conta come allenamento per la streak" });
    router.replace(`/run/${id}`);
  };
}

function ManualForm() {
  const onSaved = useSaved();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    distanceKm: "",
    duration: "",
    elevationGain: "",
    avgHeartRate: "",
    notes: "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const km = toNumber(form.distanceKm);
  const seconds = parseDuration(form.duration);
  const pace = km && seconds ? seconds / km : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!km || km <= 0) return toast({ title: "Inserisci i km", variant: "destructive" });
    if (!seconds) return toast({ title: "Durata non valida", description: "Usa ore:min:sec o min:sec", variant: "destructive" });
    setSaving(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          startedAt: new Date(form.startedAt).toISOString(),
          distanceKm: km,
          durationSeconds: seconds,
          elevationGain: toNumber(form.elevationGain),
          avgHeartRate: toNumber(form.avgHeartRate),
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Dati non validi"));
      await onSaved((await res.json()).id);
    } catch (error) {
      toast({ title: "Non salvata", description: (error as Error).message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome" htmlFor="name">
        <Input id="name" placeholder="Corsa" value={form.name} onChange={set("name")} maxLength={200} />
      </Field>
      <Field label="Data e ora" htmlFor="startedAt">
        <Input id="startedAt" type="datetime-local" value={form.startedAt} onChange={set("startedAt")} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Distanza (km)" htmlFor="distanceKm">
          <Input id="distanceKm" inputMode="decimal" placeholder="5,0" value={form.distanceKm} onChange={set("distanceKm")} required />
        </Field>
        <Field label="Durata" htmlFor="duration">
          <Input id="duration" inputMode="numeric" placeholder="25:30" value={form.duration} onChange={set("duration")} required />
        </Field>
      </div>
      <p className="text-sm text-muted-foreground">
        Ritmo: <span className="font-semibold tabular-nums text-foreground">{formatPace(pace)}/km</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dislivello (m)" htmlFor="elevationGain">
          <Input id="elevationGain" inputMode="numeric" placeholder="facoltativo" value={form.elevationGain} onChange={set("elevationGain")} />
        </Field>
        <Field label="FC media" htmlFor="avgHeartRate">
          <Input id="avgHeartRate" inputMode="numeric" placeholder="facoltativa" value={form.avgHeartRate} onChange={set("avgHeartRate")} />
        </Field>
      </div>
      <Field label="Note" htmlFor="notes">
        <Textarea id="notes" rows={3} value={form.notes} onChange={set("notes")} maxLength={2000} />
      </Field>
      <Button type="submit" size="xl" className="w-full" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Salva corsa
      </Button>
    </form>
  );
}

function GpxForm() {
  const onSaved = useSaved();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/runs/import-gpx", { method: "POST", body });
      if (!res.ok) throw new Error(await apiError(res, "File non valido"));
      await onSaved((await res.json()).id);
    } catch (error) {
      toast({ title: "Import non riuscito", description: (error as Error).message, variant: "destructive" });
      setUploading(false);
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => input.current?.click()}
        disabled={uploading}
        className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-muted-foreground active:bg-muted/50"
      >
        {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileUp className="h-8 w-8" />}
        <span className="text-sm font-medium">{uploading ? "Analisi del percorso…" : "Scegli un file .gpx"}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <p className="text-xs text-muted-foreground">
        Percorso, parziali al km, migliori tempi, dislivello, frequenza cardiaca e cadenza vengono calcolati dal file.
        Lo stesso file caricato due volte non crea doppioni. Esporta il GPX da Strava (⋯ → Esporta GPX), da Mi Fitness o
        da app come HealthFit per Apple Salute.
      </p>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
