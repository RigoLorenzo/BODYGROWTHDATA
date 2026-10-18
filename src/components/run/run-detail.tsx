"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDuration, formatKm, formatPace, formatSpeed, paceSecondsPerKm } from "@/lib/run/format";
import type { RunSplit } from "@/lib/run/track";
import { apiError, useInvalidateRuns, useRun } from "./queries";
import { RouteMap } from "./route-map";
import type { RunDetail as Run } from "./types";

const SOURCE_LABEL = { STRAVA: "Strava", MI_FITNESS: "Mi Fitness", GPX: "File GPX", MANUAL: "Inserita a mano" } as const;

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums leading-tight">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function stats(run: Run) {
  const items: { label: string; value: string | number; unit?: string }[] = [
    { label: "Distanza", value: formatKm(run.distance), unit: "km" },
    { label: "Ritmo medio", value: formatPace(paceSecondsPerKm(run.distance, run.movingTime)), unit: "/km" },
    { label: "Tempo", value: formatDuration(run.movingTime) },
    { label: "Velocità", value: formatSpeed(run.distance, run.movingTime), unit: "km/h" },
  ];
  if (run.elapsedTime > run.movingTime + 30) items.push({ label: "Tempo totale", value: formatDuration(run.elapsedTime) });
  if (run.elevationGain != null) items.push({ label: "Dislivello", value: Math.round(run.elevationGain), unit: "m" });
  if (run.avgHeartRate) items.push({ label: "FC media", value: Math.round(run.avgHeartRate), unit: "bpm" });
  if (run.maxHeartRate) items.push({ label: "FC max", value: Math.round(run.maxHeartRate), unit: "bpm" });
  if (run.avgCadence) items.push({ label: "Cadenza", value: run.avgCadence, unit: "ppm" });
  if (run.calories) items.push({ label: "Calorie", value: Math.round(run.calories), unit: "kcal" });
  if (run.trainingLoad != null) items.push({ label: "Carico", value: Math.round(run.trainingLoad) });
  return items;
}

/** Parziali al km: barra proporzionale alla velocità, il più veloce evidenziato */
function Splits({ splits }: { splits: RunSplit[] }) {
  const paces = splits.map((s) => paceSecondsPerKm(s.distance, s.seconds) ?? Infinity);
  const best = Math.min(...paces);
  const hasHr = splits.some((s) => s.heartRate);
  const hasEle = splits.some((s) => s.elevation != null);

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Parziali</h2>
      <div className="mb-1 flex text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="w-9">Km</span>
        <span className="w-14">Ritmo</span>
        <span className="flex-1" />
        {hasEle && <span className="w-12 text-right">Disl.</span>}
        {hasHr && <span className="w-12 text-right">FC</span>}
      </div>
      <ul className="space-y-1.5">
        {splits.map((s, i) => {
          const pace = paces[i];
          // Lunghezza proporzionale alla velocità: il più veloce al 100%
          const width = Number.isFinite(pace) ? (best / pace) * 100 : 0;
          return (
            <li key={s.km} className="flex items-center text-sm tabular-nums">
              <span className="w-9 text-muted-foreground">{s.distance < 950 ? formatKm(s.distance) : s.km}</span>
              <span className="w-14 font-semibold">{formatPace(pace)}</span>
              <span className="flex-1 pr-2">
                <span
                  className={pace === best ? "block h-2.5 rounded-full bg-lime-500" : "block h-2.5 rounded-full bg-foreground/25"}
                  style={{ width: `${width}%` }}
                />
              </span>
              {hasEle && (
                <span className="w-12 text-right text-muted-foreground">
                  {s.elevation != null ? `${s.elevation > 0 ? "+" : ""}${s.elevation}` : "–"}
                </span>
              )}
              {hasHr && <span className="w-12 text-right text-muted-foreground">{s.heartRate ?? "–"}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BestEfforts({ efforts }: { efforts: NonNullable<Run["bestEfforts"]> }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Migliori tempi</h2>
      <ul className="divide-y divide-border/50">
        {efforts.map((e) => (
          <li key={e.name} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium">{e.name}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{formatDuration(e.seconds)}</span>
              <span className="ml-2 text-muted-foreground">{formatPace(paceSecondsPerKm(e.distance, e.seconds))}/km</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Nome e note modificabili */
function EditForm({ run, onDone }: { run: Run; onDone: () => void }) {
  const invalidate = useInvalidateRuns();
  const [name, setName] = useState(run.name);
  const [notes, setNotes] = useState(run.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Corsa", notes: notes.trim() || null }),
      });
      if (!res.ok) throw new Error(await apiError(res));
      await invalidate();
      onDone();
    } catch (error) {
      toast({ title: "Non salvato", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} aria-label="Nome" />
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="Note" aria-label="Note" />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Salva
        </Button>
      </div>
    </form>
  );
}

export function RunDetail({ id }: { id: string }) {
  const router = useRouter();
  const invalidate = useInvalidateRuns();
  const { data: run, isLoading, isError } = useRun(id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="aspect-square rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }
  if (isError || !run) return <p className="text-sm text-muted-foreground">Corsa non trovata.</p>;

  const remove = async () => {
    if (!confirm("Eliminare questa corsa? Verrà tolta anche dal calendario e dalla streak.")) return;
    setDeleting(true);
    const res = await fetch(`/api/runs/${run.id}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      return toast({ title: "Non eliminata", description: await apiError(res), variant: "destructive" });
    }
    router.replace("/run");
    await invalidate(run.id);
  };

  const date = new Date(run.startedAt);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold leading-tight">{run.name}</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy · HH:mm", { locale: it })} · {SOURCE_LABEL[run.source]}
          </p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          aria-label="Modifica nome e note"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {editing && <EditForm run={run} onDone={() => setEditing(false)} />}

      {run.polyline && <RouteMap polyline={run.polyline} className="aspect-square w-full rounded-3xl" strokeWidth={4} showEnds />}

      <section className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-3xl border border-border/60 bg-card p-5">
        {stats(run).map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </section>

      {!editing && run.notes && (
        <p className="whitespace-pre-line rounded-3xl border border-border/60 bg-card p-5 text-sm">{run.notes}</p>
      )}

      {run.splits && run.splits.length > 0 && <Splits splits={run.splits} />}
      {run.bestEfforts && run.bestEfforts.length > 0 && <BestEfforts efforts={run.bestEfforts} />}
      {(run.source === "STRAVA" || run.source === "MI_FITNESS") && !run.detailed && (
        <p className="text-xs text-muted-foreground">
          Percorso e parziali non ancora disponibili da {SOURCE_LABEL[run.source]}: riapri più tardi.
        </p>
      )}

      <div className="space-y-2">
        {run.source === "STRAVA" && run.externalId && (
          <Button asChild variant="outline" className="w-full">
            <a href={`https://www.strava.com/activities/${run.externalId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Apri su Strava
            </a>
          </Button>
        )}
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={remove} disabled={deleting}>
          {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Elimina corsa
        </Button>
      </div>
    </div>
  );
}
