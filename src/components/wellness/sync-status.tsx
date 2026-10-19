"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { History, RefreshCw, Watch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { syncMiFitness, useMiFitnessSyncing } from "@/components/run/mifitness-sync";
import { cn } from "@/lib/utils";
import type { WellnessProgress, WellnessResponse } from "@/lib/wellness/types";
import { EmptyState } from "@/components/analytics/ui";

function useManualSync() {
  const qc = useQueryClient();
  const syncing = useMiFitnessSyncing();
  const sync = async () => {
    const outcome = await syncMiFitness({ auto: false });
    if (!outcome.ok) toast({ title: "Mi Fitness", description: outcome.error, variant: "destructive" });
    await Promise.all([qc.invalidateQueries({ queryKey: ["wellness"] }), outcome.ok && outcome.imported && qc.invalidateQueries({ queryKey: ["runs"] })]);
  };
  return { sync, syncing };
}

/** Ultimo aggiornamento, storico in arrivo e sincronizzazione a mano */
export function SyncStatus({ data }: { data: WellnessResponse }) {
  const { sync, syncing } = useManualSync();
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
      <span className="min-w-0">
        <Watch className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        {data.lastSyncAt ? `Aggiornato ${formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true, locale: it })}` : "Mai sincronizzato"}
      </span>
      <button
        type="button"
        onClick={sync}
        disabled={syncing}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 font-medium text-foreground active:bg-muted/70 disabled:opacity-60"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> {syncing ? "In corso" : "Aggiorna"}
      </button>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: { done: number; total: number } }) {
  const pct = Math.round((value.done / value.total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.done}/{value.total} giorni
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Storico in arrivo dall'orologio: avanzamento e cosa fare se si blocca */
export function HistoryProgress({ data, progress, active }: { data: WellnessResponse; progress: WellnessProgress | null; active: boolean }) {
  if (!data.connected) return null;
  if (data.needsReconnect) {
    return (
      <EmptyState>
        Il collegamento a Mi Fitness è scaduto: lo storico non può avanzare.{" "}
        <Link href="/run" className="font-medium text-foreground underline underline-offset-2">
          Ricollega
        </Link>
      </EmptyState>
    );
  }
  if (!progress || progress.complete) return null;
  return (
    <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <History className={cn("h-4 w-4", active && "animate-pulse")} /> Scarico lo storico dall&apos;orologio
      </p>
      <Bar label="Sonno, passi, stress e SpO₂" value={progress.light} />
      <Bar label="Battiti al minuto" value={progress.heart} />
      <p className="text-xs text-muted-foreground">
        {active
          ? "Con questa pagina aperta va più veloce: i grafici si riempiono man mano."
          : "Riprende alla prossima apertura e ogni notte."}
        {data.syncError && ` Non scaricati: ${data.syncError}.`}
      </p>
    </section>
  );
}

/** Senza orologio collegato o prima della prima sincronizzazione */
export function WellnessEmpty({ connected }: { connected: boolean }) {
  const { sync, syncing } = useManualSync();
  if (!connected) {
    return (
      <EmptyState>
        Collega il tuo smartwatch Xiaomi per vedere sonno, battiti, passi e stress.{" "}
        <Link href="/run" className="font-medium text-foreground underline underline-offset-2">
          Collega Mi Fitness
        </Link>
      </EmptyState>
    );
  }
  return (
    <EmptyState>
      <span className="block">I dati dell&apos;orologio non sono ancora arrivati.</span>
      <button type="button" onClick={sync} disabled={syncing} className="mt-3 font-medium text-foreground underline underline-offset-2">
        {syncing ? "Sincronizzazione in corso…" : "Sincronizza ora"}
      </button>
    </EmptyState>
  );
}
