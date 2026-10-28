"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Versione inclusa nel bundle al momento della build (vedi next.config.ts)
const BUILT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const CHECK_INTERVAL_MS = 5 * 60_000;

async function fetchLiveVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const { version } = (await res.json()) as { version?: string };
    return version ?? null;
  } catch {
    return null;
  }
}

/**
 * La PWA resta aperta in background con il codice vecchio anche dopo un
 * deploy: quando torna in primo piano controlla la versione pubblicata e,
 * se è cambiata, propone di ricaricare. Niente ricarica automatica, per non
 * interrompere un allenamento in corso.
 */
export function UpdateNotice() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (BUILT_VERSION === "dev") return;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const live = await fetchLiveVersion();
      if (live && live !== "dev" && live !== BUILT_VERSION) setOutdated(true);
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!outdated) return null;

  return (
    <div className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] mx-auto flex max-w-sm items-center gap-3 rounded-xl border bg-card p-3 pl-4 text-card-foreground shadow-lg animate-fade-in">
      <p className="flex-1 text-sm font-medium">Nuova versione disponibile</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground touch-manipulation"
      >
        <RefreshCw className="h-4 w-4" />
        Aggiorna
      </button>
    </div>
  );
}
