"use client";

import { useSyncExternalStore } from "react";
import { DEVICE_LABEL, type DeviceProvider } from "./labels";

/**
 * Sincronizzazione dei dispositivi lato client, condivisa da sync automatica
 * e pulsanti: una richiesta alla volta per dispositivo, chi arriva mentre è
 * in corso aspetta quella. La logica vera resta in POST /api/integrations/…/sync.
 */

export type SyncOutcome =
  | { ok: true; imported: number; wellness: number; skipped: boolean }
  | { ok: false; error: string; reconnect: boolean; retryable: boolean };

const SYNC_PATH: Record<DeviceProvider, string> = {
  MI_FITNESS: "/api/integrations/mifitness/sync",
  GARMIN: "/api/integrations/garmin/sync",
};

const inFlight = new Map<DeviceProvider, Promise<SyncOutcome>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function request(provider: DeviceProvider, auto: boolean): Promise<SyncOutcome> {
  try {
    const res = await fetch(`${SYNC_PATH[provider]}${auto ? "?auto=1" : ""}`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, imported: body?.imported ?? 0, wellness: body?.wellness ?? 0, skipped: !!body?.skipped };
    const reconnect = !!body?.reconnect;
    return {
      ok: false,
      error: typeof body?.error === "string" ? body.error : `${DEVICE_LABEL[provider]}: sincronizzazione non riuscita`,
      reconnect,
      // 4xx (non collegato, accesso scaduto) non si risolvono riprovando
      retryable: !reconnect && (res.status >= 500 || res.status === 429),
    };
  } catch {
    return { ok: false, error: "Rete non disponibile", reconnect: false, retryable: true };
  }
}

/** Avvia la sincronizzazione di un dispositivo o si aggancia a quella in corso */
export async function syncDevice(provider: DeviceProvider, { auto }: { auto: boolean }): Promise<SyncOutcome> {
  const running = inFlight.get(provider);
  if (running) {
    const outcome = await running;
    // Una sync automatica può essere saltata dal server: quella manuale riparte
    if (auto || !(outcome.ok && outcome.skipped)) return outcome;
  }
  const next = request(provider, auto).finally(() => {
    inFlight.delete(provider);
    notify();
  });
  inFlight.set(provider, next);
  notify();
  return next;
}

/** Più dispositivi in parallelo: ognuno ha la sua funzione serverless */
export async function syncDevices(providers: DeviceProvider[], opts: { auto: boolean }) {
  const outcomes = await Promise.all(providers.map((p) => syncDevice(p, opts)));
  return providers.map((provider, i) => ({ provider, outcome: outcomes[i] }));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** true mentre una sincronizzazione è in corso (del dispositivo indicato o di uno qualsiasi) */
export const useDeviceSyncing = (provider?: DeviceProvider) =>
  useSyncExternalStore(
    subscribe,
    () => (provider ? inFlight.has(provider) : inFlight.size > 0),
    () => false
  );

/** Evento per chiedere alla card di un dispositivo di avviare il (ri)collegamento */
export const RECONNECT_EVENT = "device:reconnect";

export const requestDeviceReconnect = (provider: DeviceProvider) =>
  window.dispatchEvent(new CustomEvent<DeviceProvider>(RECONNECT_EVENT, { detail: provider }));
