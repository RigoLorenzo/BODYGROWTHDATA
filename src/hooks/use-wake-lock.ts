"use client";

import { useEffect } from "react";

export const WAKE_LOCK_KEY = "bodygrowth-keep-awake";

/** Preferenza "schermo sempre acceso in allenamento" (attiva di default) */
export function readKeepAwake(): boolean {
  try {
    return localStorage.getItem(WAKE_LOCK_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveKeepAwake(enabled: boolean) {
  try {
    localStorage.setItem(WAKE_LOCK_KEY, enabled ? "on" : "off");
  } catch {
    // Storage non disponibile: vale solo per questa visita
  }
}

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };

/**
 * Tiene acceso lo schermo mentre la schermata è aperta: tra una serie e
 * l'altra il telefono non si blocca. Il browser rilascia il blocco quando
 * l'app va in background, quindi lo si richiede al ritorno.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    if (!enabled || !nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) await lock.release();
        else sentinel = lock;
      } catch {
        // Batteria scarica o permesso negato: si continua senza
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
