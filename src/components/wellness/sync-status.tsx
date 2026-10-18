"use client";

import Link from "next/link";
import { formatDistanceToNow, parseISO, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { RefreshCw, Watch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { syncMiFitness, useMiFitnessSyncing } from "@/components/run/mifitness-sync";
import { cn } from "@/lib/utils";
import { WELLNESS_HISTORY_DAYS } from "@/lib/wellness/constants";
import type { WellnessResponse } from "@/lib/wellness/types";
import { EmptyState } from "@/components/analytics/ui";
import { dayLabel } from "./queries";

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
  const historyStart = subDays(new Date(), WELLNESS_HISTORY_DAYS - 1);
  const backfilling = data.syncedFrom && parseISO(data.syncedFrom) > historyStart;
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
      <span className="min-w-0">
        <Watch className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        {data.lastSyncAt ? `Aggiornato ${formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true, locale: it })}` : "Mai sincronizzato"}
        {backfilling && ` · storico dal ${dayLabel(data.syncedFrom!)}, il resto arriva a breve`}
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
