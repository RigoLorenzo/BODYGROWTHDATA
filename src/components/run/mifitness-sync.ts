"use client";

import { useSyncExternalStore } from "react";

/**
 * Sincronizzazione Mi Fitness lato client, condivisa da sync automatica e
 * pulsante: una sola richiesta alla volta, chi arriva mentre è in corso
 * aspetta quella. La logica vera resta in POST /api/integrations/mifitness/sync.
 */

export type SyncOutcome =
  | { ok: true; imported: number; wellness: number; skipped: boolean }
  | { ok: false; error: string; reconnect: boolean; retryable: boolean };

let inFlight: Promise<SyncOutcome> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

async function request(auto: boolean): Promise<SyncOutcome> {
  try {
    const res = await fetch(`/api/integrations/mifitness/sync${auto ? "?auto=1" : ""}`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, imported: body?.imported ?? 0, wellness: body?.wellness ?? 0, skipped: !!body?.skipped };
    const reconnect = !!body?.reconnect;
    return {
      ok: false,
      error: typeof body?.error === "string" ? body.error : "Sincronizzazione non riuscita",
      reconnect,
      // 4xx (non collegato, sessione scaduta) non si risolvono riprovando
      retryable: !reconnect && (res.status >= 500 || res.status === 429),
    };
  } catch {
    return { ok: false, error: "Rete non disponibile", reconnect: false, retryable: true };
  }
}

/** Avvia la sincronizzazione o si aggancia a quella già in corso */
export async function syncMiFitness({ auto }: { auto: boolean }): Promise<SyncOutcome> {
  if (inFlight) {
    const running = await inFlight;
    // Una sync automatica può essere saltata dal server: quella manuale riparte
    if (auto || !(running.ok && running.skipped)) return running;
  }
  inFlight = request(auto).finally(() => {
    inFlight = null;
    notify();
  });
  notify();
  return inFlight;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** true mentre una sincronizzazione (automatica o manuale) è in corso */
export const useMiFitnessSyncing = () =>
  useSyncExternalStore(
    subscribe,
    () => inFlight !== null,
    () => false
  );

/** Evento per chiedere alla card Mi Fitness di avviare il ricollegamento */
export const RECONNECT_EVENT = "mifitness:reconnect";

export const requestMiFitnessReconnect = () => window.dispatchEvent(new Event(RECONNECT_EVENT));
