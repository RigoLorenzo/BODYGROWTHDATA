"use client";

import Link from "next/link";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { History, RefreshCw, Watch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { syncDevice, useDeviceSyncing } from "@/components/devices/device-sync";
import { DEVICE_LABEL, type DeviceProvider } from "@/components/devices/labels";
import { cn } from "@/lib/utils";
import type { HistoryTrack, WellnessProgress, WellnessResponse } from "@/lib/wellness/types";
import { EmptyState } from "@/components/analytics/ui";

/** Sincronizza a mano l'orologio da cui arriva il benessere */
function useManualSync(source: DeviceProvider | null) {
  const qc = useQueryClient();
  const syncing = useDeviceSyncing(source ?? undefined);
  const sync = async () => {
    if (!source) return;
    const outcome = await syncDevice(source, { auto: false });
    if (!outcome.ok) toast({ title: DEVICE_LABEL[source], description: outcome.error, variant: "destructive" });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["wellness"] }),
      qc.invalidateQueries({ queryKey: ["devices"] }),
      outcome.ok && outcome.imported && qc.invalidateQueries({ queryKey: ["runs"] }),
    ]);
  };
  return { sync, syncing };
}

/** Ultimo aggiornamento, storico in arrivo e sincronizzazione a mano */
export function SyncStatus({ data }: { data: WellnessResponse }) {
  const { sync, syncing } = useManualSync(data.source);
  const updated = data.lastSyncAt
    ? `aggiornato ${formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true, locale: it })}`
    : "mai sincronizzato";
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
      <span className="min-w-0">
        <Watch className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        {data.source ? `${DEVICE_LABEL[data.source]} · ${updated}` : updated}
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

function Bar({ label, track, detail }: { label: string; track: HistoryTrack; detail: string }) {
  const pct = Math.round((track.done / track.total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{detail}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const sinceLabel = (track: HistoryTrack) =>
  track.complete ? "completo" : track.since ? `dal ${format(parseISO(track.since), "d MMM yyyy", { locale: it })}` : "in avvio";

/** Storico in arrivo dall'orologio: avanzamento e cosa fare se si blocca */
export function HistoryProgress({ data, progress, active }: { data: WellnessResponse; progress: WellnessProgress | null; active: boolean }) {
  if (!data.connected) return null;
  if (data.needsReconnect) {
    return (
      <EmptyState>
        Il collegamento a {data.source ? DEVICE_LABEL[data.source] : "lo smartwatch"} è scaduto: lo storico non può
        avanzare.{" "}
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
      <Bar label="Sonno, passi, stress e SpO₂" track={progress.light} detail={sinceLabel(progress.light)} />
      <Bar
        label="Battiti al minuto"
        track={progress.heart}
        detail={progress.heart.complete ? "completo" : `${progress.heart.done}/${progress.heart.total} giorni`}
      />
      <p className="text-xs text-muted-foreground">
        {active
          ? "Tutto lo storico dell'orologio, fino a 3 anni (battiti: 1 anno). Con questa pagina aperta va più veloce e i grafici si riempiono man mano."
          : "Riprende alla prossima apertura e ogni notte."}
        {data.syncError && ` Non scaricati: ${data.syncError}.`}
      </p>
    </section>
  );
}

/** Senza orologio collegato o prima della prima sincronizzazione */
export function WellnessEmpty({ connected, source }: { connected: boolean; source: DeviceProvider | null }) {
  const { sync, syncing } = useManualSync(source);
  if (!connected) {
    return (
      <EmptyState>
        Collega il tuo smartwatch (Xiaomi o Garmin) per vedere sonno, battiti, passi e stress.{" "}
        <Link href="/run#devices-title" className="font-medium text-foreground underline underline-offset-2">
          Collega uno smartwatch
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
