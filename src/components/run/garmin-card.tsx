"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, ExternalLink, Loader2, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { RECONNECT_EVENT } from "@/components/devices/device-sync";
import { apiError, useGarminStatus, useInvalidateRuns } from "./queries";

/** Pagina di Garmin Connect dove si crea la chiave personale */
const KEY_PAGE = "https://connect.garmin.com/app/settings/personalApiToken";
const BRAND = "bg-[#007CC3] text-white hover:bg-[#007CC3]/90";

/** Chiave incollata dall'utente: verificata e salvata cifrata dal server */
function ApiKeyForm({ reconnect, onConnected }: { reconnect: boolean; onConnected: (imported: number | null) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = (event: Event) => {
      if ((event as CustomEvent).detail === "GARMIN") inputRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener(RECONNECT_EVENT, focus);
    return () => window.removeEventListener(RECONNECT_EVENT, focus);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Chiave non valida"));
      setApiKey("");
      onConnected((await res.json()).imported ?? null);
    } catch (error) {
      toast({ title: "Collegamento non riuscito", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
        <li>
          Apri la pagina{" "}
          <a href={KEY_PAGE} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
            Personal API key di Garmin Connect
            <ExternalLink className="ml-0.5 inline h-3 w-3 align-[-1px]" aria-hidden />
          </a>{" "}
          (accesso dal browser).
        </li>
        <li>Tocca Crea chiave, accetta i termini e scegli la scadenza: con 1 anno la rinnovi meno spesso.</li>
        <li>Copia la chiave (Garmin la mostra una volta sola) e incollala qui.</li>
      </ol>
      <div className="space-y-1.5">
        <Label htmlFor="garmin-key" className="text-xs">
          Chiave personale Garmin
        </Label>
        <Input
          ref={inputRef}
          id="garmin-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className={`w-full ${BRAND}`} disabled={saving || !apiKey.trim()}>
        {saving && <Loader2 className="animate-spin" />}
        {reconnect ? "Aggiorna chiave Garmin" : "Collega Garmin"}
      </Button>
      <p className="text-xs text-muted-foreground">
        API ufficiale Garmin, in sola lettura. La chiave è salvata cifrata e non esce mai dal server; puoi revocarla in
        ogni momento eliminandola su Garmin Connect.
      </p>
    </form>
  );
}

/**
 * Collegamento a Garmin Connect con la Personal API: corse con percorso e
 * dati benessere. La sincronizzazione sta nell'header della pagina.
 */
export function GarminCard() {
  const { data, isLoading } = useGarminStatus();
  const invalidate = useInvalidateRuns();
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const conn = data?.connection;
  const needsKey = !conn || !!conn.lastError;

  useEffect(() => {
    const onReconnect = (event: Event) => {
      if ((event as CustomEvent).detail !== "GARMIN") return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rootRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    };
    window.addEventListener(RECONNECT_EVENT, onReconnect);
    return () => window.removeEventListener(RECONNECT_EVENT, onReconnect);
  }, []);

  const onConnected = async (imported: number | null) => {
    toast({
      title: "Garmin collegato",
      description: imported ? `Importate ${imported} corse` : "Le corse arriveranno alla prossima sincronizzazione",
    });
    await invalidate();
  };

  const disconnect = async () => {
    if (!confirm("Scollegare Garmin? Le corse e i dati già importati restano.")) return;
    setBusy(true);
    await fetch("/api/integrations/garmin", { method: "DELETE" });
    setBusy(false);
    await invalidate();
  };

  return (
    <section
      ref={rootRef}
      id="garmin"
      aria-labelledby="garmin-title"
      className="scroll-mt-4 rounded-3xl border border-border/60 bg-card p-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#007CC3] text-white">
          <Watch className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="garmin-title" className="text-sm font-semibold">
            Garmin
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {isLoading
              ? "…"
              : conn
                ? [
                    conn.account,
                    conn.lastSyncAt
                      ? `sincronizzato ${formatDistanceToNow(new Date(conn.lastSyncAt), { locale: it, addSuffix: true })}`
                      : "collegato",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Forerunner, Fenix, Venu…: corse e benessere, in automatico"}
          </p>
        </div>
      </div>

      {conn?.lastError && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {conn.lastError}
        </p>
      )}

      {conn && !conn.lastError && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Si aggiorna da solo ogni 15 minuti con l&apos;app aperta.</p>
          <Button variant="outline" size="sm" className="h-10 shrink-0" onClick={disconnect} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Scollega
          </Button>
        </div>
      )}

      {needsKey && !isLoading && <ApiKeyForm reconnect={!!conn} onConnected={onConnected} />}

      {conn?.lastError && (
        <button onClick={disconnect} disabled={busy} className="mt-2 h-10 text-xs text-muted-foreground active:text-destructive">
          Scollega
        </button>
      )}
    </section>
  );
}
