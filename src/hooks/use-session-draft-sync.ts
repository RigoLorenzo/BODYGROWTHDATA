"use client";

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/store/session-store";
import { draftFromSession } from "@/lib/session-draft";

const DEBOUNCE_MS = 1500;

/**
 * Salva sul server lo stato dell'allenamento in corso mentre ti alleni:
 * poco dopo ogni modifica e subito quando l'app va in background o si chiude.
 * Se il telefono perde i dati locali, l'allenamento si riprende da lì.
 */
export function useSessionDraftSync() {
  const lastSent = useRef<string>("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = () => {
      clearTimeout(timer);
      const session = useSessionStore.getState().activeSession;
      if (!session) return;
      const body = JSON.stringify(draftFromSession(session));
      if (body === lastSent.current) return;
      lastSent.current = body;
      fetch(`/api/sessions/${session.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        // Offline: riprova alla prossima modifica
        lastSent.current = "";
      });
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(send, DEBOUNCE_MS);
    };

    const unsubscribe = useSessionStore.subscribe((state, prev) => {
      if (state.activeSession && state.activeSession !== prev.activeSession) schedule();
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };

    schedule();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);
    return () => {
      send();
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
    };
  }, []);
}
