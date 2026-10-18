"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiError, useInvalidateRuns, useStravaStatus } from "./queries";

const RETURN_MESSAGES: Record<string, { title: string; description?: string; error?: boolean }> = {
  denied: { title: "Collegamento annullato", description: "Non hai autorizzato l'accesso su Strava", error: true },
  "invalid-state": { title: "Sessione scaduta", description: "Riprova a collegare Strava", error: true },
  "missing-scope": {
    title: "Permesso mancante",
    description: "Lascia attiva la lettura delle attività quando autorizzi Strava",
    error: true,
  },
  "not-configured": {
    title: "Strava non configurato",
    description: "Mancano STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET sul server",
    error: true,
  },
  "sync-failed": { title: "Strava collegato", description: "Import non riuscito ora: riprova con Sincronizza" },
  error: { title: "Collegamento non riuscito", description: "Riprova tra qualche minuto", error: true },
};

/** Esito del ritorno da Strava (?strava=…), mostrato una volta e tolto dall'URL */
function useReturnStatus() {
  const params = useSearchParams();
  const router = useRouter();
  const invalidate = useInvalidateRuns();
  const status = params.get("strava");

  useEffect(() => {
    if (!status) return;
    if (status === "connected") {
      const n = Number(params.get("imported") ?? 0);
      toast({ title: "Strava collegato", description: n ? `Importate ${n} corse` : "Nessuna corsa da importare" });
    } else {
      const msg = RETURN_MESSAGES[status] ?? RETURN_MESSAGES.error;
      toast({ title: msg.title, description: msg.description, variant: msg.error ? "destructive" : "default" });
    }
    void invalidate();
    router.replace("/run", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}

/** Collegamento a Strava: Xiaomi → Mi Fitness → Strava → BodyGrowth */
export function StravaCard() {
  useReturnStatus();
  const { data } = useStravaStatus();
  const invalidate = useInvalidateRuns();
  const [busy, setBusy] = useState<"sync" | "subscribe" | "disconnect" | null>(null);

  const call = async (kind: NonNullable<typeof busy>, url: string, method: string) => {
    setBusy(kind);
    try {
      const res = await fetch(url, { method });
      if (!res.ok) throw new Error(await apiError(res));
      return await res.json();
    } catch (error) {
      toast({ title: "Strava", description: (error as Error).message, variant: "destructive" });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    const result = await call("sync", "/api/integrations/strava", "POST");
    if (!result) return;
    toast({ title: "Sincronizzato", description: result.imported ? `${result.imported} corse aggiornate` : "Nessuna corsa nuova" });
    await invalidate();
  };

  const subscribe = async () => {
    const result = await call("subscribe", "/api/integrations/strava/subscribe", "POST");
    if (result) toast({ title: "Aggiornamenti automatici attivi", description: "Le nuove corse arrivano da sole" });
  };

  const disconnect = async () => {
    if (!confirm("Scollegare Strava? Le corse già importate restano.")) return;
    if (await call("disconnect", "/api/integrations/strava", "DELETE")) await invalidate();
  };

  const conn = data?.connection;

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FC4C02] font-display text-lg font-bold text-white">
          S
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Strava</p>
          <p className="truncate text-xs text-muted-foreground">
            {conn
              ? `${conn.athleteName ?? "Collegato"}${
                  conn.lastSyncAt
                    ? ` · sincronizzato ${formatDistanceToNow(new Date(conn.lastSyncAt), { locale: it, addSuffix: true })}`
                    : ""
                }`
              : "Importa le corse dell'orologio (Mi Fitness, Apple Salute, Garmin…)"}
          </p>
        </div>
      </div>

      {conn ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={sync} disabled={!!busy}>
            {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Sincronizza
          </Button>
          <Button variant="outline" onClick={subscribe} disabled={!!busy}>
            {busy === "subscribe" ? <Loader2 className="animate-spin" /> : <Zap />}
            Automatico
          </Button>
          <button
            onClick={disconnect}
            disabled={!!busy}
            className="col-span-2 h-10 text-xs text-muted-foreground active:text-destructive"
          >
            Scollega Strava
          </button>
        </div>
      ) : (
        <>
          <Button asChild className="mt-4 w-full bg-[#FC4C02] text-white hover:bg-[#FC4C02]/90">
            {/* Navigazione completa: il redirect OAuth deve passare dal server */}
            <a href="/api/integrations/strava/connect">Collega Strava</a>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Xiaomi Watch: in Mi Fitness apri Profilo → Account collegati → Strava. Ogni corsa dell&apos;orologio arriva
            su Strava e da lì qui, con percorso, parziali e frequenza cardiaca.
          </p>
        </>
      )}
    </section>
  );
}
