"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useInvalidateRuns, useMiFitnessStatus } from "./queries";
import { requestMiFitnessReconnect, syncMiFitness, useMiFitnessSyncing } from "./mifitness-sync";

type SyncState = "loading" | "disconnected" | "expired" | "connected";

/** Ridisegna ogni minuto: "2 min fa" resta vero senza ricaricare */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

/** Stato del collegamento Mi Fitness per header e avviso */
export function useMiFitnessSyncState() {
  const { data, isLoading } = useMiFitnessStatus();
  const conn = data?.connection ?? null;
  const state: SyncState = isLoading ? "loading" : !conn ? "disconnected" : conn.lastError ? "expired" : "connected";
  return { state, conn };
}

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: it, addSuffix: true });

/** Riga di stato sotto il titolo: collegamento e ultimo aggiornamento */
function SyncStatusLine({ state, lastSyncAt, syncing }: { state: SyncState; lastSyncAt: string | null; syncing: boolean }) {
  useMinuteTick();
  if (state === "loading") return <span className="block h-4" aria-hidden />;

  const { dot, text } =
    state === "expired"
      ? { dot: "bg-amber-500", text: "Mi Fitness · collegamento scaduto" }
      : state === "disconnected"
        ? { dot: "bg-muted-foreground/50", text: "Mi Fitness non collegato" }
        : {
            dot: "bg-lime-500",
            text: syncing
              ? "Mi Fitness · sincronizzazione…"
              : `Mi Fitness · ${lastSyncAt ? `aggiornato ${ago(lastSyncAt)}` : "collegato"}`,
          };

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  );
}

/** Titolo della pagina Corsa con sincronizzazione Mi Fitness sempre a portata */
export function RunHeader() {
  const { state, conn } = useMiFitnessSyncState();
  const syncing = useMiFitnessSyncing();
  const invalidate = useInvalidateRuns();

  const sync = async () => {
    const outcome = await syncMiFitness({ auto: false });
    if (outcome.ok) {
      toast({
        title: "Sincronizzato",
        description: outcome.imported ? `${outcome.imported} corse aggiornate` : "Nessuna corsa nuova",
      });
    } else {
      toast({ title: "Mi Fitness", description: outcome.error, variant: "destructive" });
    }
    await invalidate();
  };

  const action =
    state === "connected"
      ? { label: "Sincronizza", onClick: sync }
      : state === "loading"
        ? null
        : { label: state === "expired" ? "Ricollega" : "Collega", onClick: requestMiFitnessReconnect };

  return (
    <header className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">Corsa</h1>
        <div className="mt-1.5">
          <SyncStatusLine state={state} lastSyncAt={conn?.lastSyncAt ?? null} syncing={syncing} />
        </div>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={syncing}
          aria-busy={syncing}
          className={cn(
            "flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium active:scale-95 disabled:opacity-70",
            state === "expired" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted"
          )}
        >
          {state === "expired" ? (
            <AlertTriangle className="h-4 w-4" aria-hidden />
          ) : (
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin motion-reduce:animate-none")} aria-hidden />
          )}
          <span>
            {action.label}
            <span className="sr-only"> Mi Fitness</span>
          </span>
        </button>
      )}

      <Link
        href="/run/new"
        aria-label="Aggiungi corsa"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted active:scale-95"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </Link>
    </header>
  );
}

/** Avviso in cima alla pagina quando il token Xiaomi non vale più */
export function MiFitnessExpiredBanner() {
  const { state, conn } = useMiFitnessSyncState();
  if (state !== "expired") return null;

  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Collegamento Mi Fitness scaduto</p>
        <p className="mt-0.5 text-xs opacity-90">
          {conn?.lastError ?? "Le nuove corse non arrivano finché non ricolleghi l'account Xiaomi."}
        </p>
      </div>
      <button
        type="button"
        onClick={requestMiFitnessReconnect}
        className="h-10 shrink-0 rounded-full bg-foreground px-4 text-xs font-semibold text-background active:scale-95"
      >
        Ricollega
      </button>
    </div>
  );
}
