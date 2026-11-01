"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { requestDeviceReconnect, syncDevices, useDeviceSyncing } from "@/components/devices/device-sync";
import { useDevices, useInvalidateRuns } from "./queries";
import type { DevicesStatus } from "./types";

type SyncState = "loading" | "disconnected" | "expired" | "connected";
type Device = DevicesStatus["devices"][number];

/** Ridisegna ogni minuto: "2 min fa" resta vero senza ricaricare */
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

/** Stato dei dispositivi collegati per header e avviso */
export function useDevicesSyncState() {
  const { data, isLoading } = useDevices();
  const connected = data?.devices.filter((d) => d.connection) ?? [];
  const expired = connected.filter((d) => d.connection!.lastError);
  const healthy = connected.filter((d) => !d.connection!.lastError);
  const state: SyncState = isLoading
    ? "loading"
    : !connected.length
      ? "disconnected"
      : !healthy.length
        ? "expired"
        : "connected";
  const lastSyncAt =
    healthy
      .map((d) => d.connection!.lastSyncAt)
      .filter((v): v is string => !!v)
      .sort()
      .at(-1) ?? null;
  return { state, connected, expired, healthy, lastSyncAt };
}

/** Porta alla sezione Dispositivi per collegarne uno */
export function scrollToDevices() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("devices-title")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: it, addSuffix: true });
const names = (devices: Device[]) => devices.map((d) => d.label).join(", ");

/** Riga di stato sotto il titolo: dispositivi collegati e ultimo aggiornamento */
function SyncStatusLine({ sync, syncing }: { sync: ReturnType<typeof useDevicesSyncState>; syncing: boolean }) {
  useMinuteTick();
  if (sync.state === "loading") return <span className="block h-4" aria-hidden />;

  const { dot, text } =
    sync.state === "expired"
      ? { dot: "bg-amber-500", text: `${names(sync.expired)} · collegamento scaduto` }
      : sync.state === "disconnected"
        ? { dot: "bg-muted-foreground/50", text: "Nessuno smartwatch collegato" }
        : {
            dot: sync.expired.length ? "bg-amber-500" : "bg-lime-500",
            text: syncing
              ? `${names(sync.healthy)} · sincronizzazione…`
              : `${names(sync.healthy)} · ${sync.lastSyncAt ? `aggiornato ${ago(sync.lastSyncAt)}` : "collegato"}`,
          };

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  );
}

/** Titolo della pagina Corsa con la sincronizzazione dei dispositivi sempre a portata */
export function RunHeader() {
  const devices = useDevicesSyncState();
  const { state, healthy, expired } = devices;
  const syncing = useDeviceSyncing();
  const invalidate = useInvalidateRuns();

  const sync = async () => {
    const results = await syncDevices(
      healthy.map((d) => d.provider),
      { auto: false }
    );
    const imported = results.reduce((sum, r) => sum + (r.outcome.ok ? r.outcome.imported : 0), 0);
    const failed = results.filter((r) => !r.outcome.ok);
    for (const { provider, outcome } of failed) {
      if (!outcome.ok) toast({ title: healthy.find((d) => d.provider === provider)?.label, description: outcome.error, variant: "destructive" });
    }
    if (failed.length < results.length) {
      toast({ title: "Sincronizzato", description: imported ? `${imported} corse aggiornate` : "Nessuna corsa nuova" });
    }
    await invalidate();
  };

  const action =
    state === "connected"
      ? { label: "Sincronizza", onClick: sync }
      : state === "loading"
        ? null
        : state === "expired"
          ? { label: "Ricollega", onClick: () => requestDeviceReconnect(expired[0].provider) }
          : { label: "Collega", onClick: scrollToDevices };

  return (
    <header className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">Corsa</h1>
        <div className="mt-1.5">
          <SyncStatusLine sync={devices} syncing={syncing} />
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
            <span className="sr-only"> smartwatch</span>
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

/** Avviso in cima alla pagina per ogni dispositivo il cui accesso non vale più */
export function DeviceExpiredBanner() {
  const { expired } = useDevicesSyncState();
  if (!expired.length) return null;

  return (
    <>
      {expired.map((device) => (
        <div
          key={device.provider}
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Collegamento {device.label} scaduto</p>
            <p className="mt-0.5 text-xs opacity-90">
              {device.connection?.lastError ?? `Le nuove corse non arrivano finché non ricolleghi ${device.label}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestDeviceReconnect(device.provider)}
            className="h-10 shrink-0 rounded-full bg-foreground px-4 text-xs font-semibold text-background active:scale-95"
          >
            Ricollega
          </button>
        </div>
      ))}
    </>
  );
}
