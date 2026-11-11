"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

/** Attiva l'invito con un tocco esplicito (mai in automatico all'apertura del link) */
export function RedeemInvite({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/invites/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    if (res?.ok) {
      // Ricarica completa: menu e accesso si aggiornano
      window.location.href = "/coach";
      return;
    }
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "Non è stato possibile attivare l'invito. Riprova.");
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={redeem}
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background disabled:opacity-50 active:scale-[0.98]"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        Attiva il Coach
      </button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
