"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { apiError, useInvalidateRuns, useMiFitnessStatus } from "./queries";

interface QrLogin {
  qrImage: string;
  loginUrl: string;
}

/** Accesso Xiaomi con QR o link: richiama il server finché non confermi */
function useQrLogin(onConnected: (imported: number | null) => void) {
  const [qr, setQr] = useState<QrLogin | null>(null);
  const [starting, setStarting] = useState(false);
  const active = useRef(false);

  const stop = () => {
    active.current = false;
    setQr(null);
  };

  const poll = async () => {
    while (active.current) {
      const res = await fetch("/api/integrations/mifitness/qr/poll", { method: "POST" }).catch(() => null);
      if (!active.current) return;
      const body = res ? await res.json().catch(() => null) : null;
      if (body?.status === "connected") {
        stop();
        onConnected(body.imported ?? null);
        return;
      }
      if (body?.status === "expired" || body?.status === "error" || (res && !res.ok)) {
        stop();
        toast({
          title: body?.status === "expired" ? "Accesso scaduto" : "Collegamento non riuscito",
          description: body?.error ?? "Riprova",
          variant: "destructive",
        });
        return;
      }
      // Rete assente: piccola pausa prima di riprovare
      if (!res) await new Promise((r) => setTimeout(r, 3000));
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/integrations/mifitness/qr", { method: "POST" });
      if (!res.ok) throw new Error(await apiError(res, "Xiaomi non raggiungibile"));
      setQr(await res.json());
      active.current = true;
      void poll();
    } catch (error) {
      toast({ title: "Mi Fitness", description: (error as Error).message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => () => void (active.current = false), []);
  return { qr, starting, start, stop };
}

/** Alternativa al QR: userId e passToken copiati dai cookie di account.xiaomi.com */
function ManualToken({ onConnected }: { onConnected: (imported: number | null) => void }) {
  const [userId, setUserId] = useState("");
  const [passToken, setPassToken] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/mifitness/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, passToken }),
      });
      if (!res.ok) throw new Error(await apiError(res, "Token non valido"));
      onConnected((await res.json()).imported ?? null);
    } catch (error) {
      toast({ title: "Collegamento non riuscito", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="xiaomi-user" className="text-xs">
          userId
        </Label>
        <Input id="xiaomi-user" inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="xiaomi-token" className="text-xs">
          passToken
        </Label>
        <Input
          id="xiaomi-token"
          type="password"
          autoComplete="off"
          value={passToken}
          onChange={(e) => setPassToken(e.target.value)}
          required
        />
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Collega con token
      </Button>
    </form>
  );
}

/** Collegamento diretto a Mi Fitness (Xiaomi Watch, Smart Band) */
export function MiFitnessCard() {
  const { data, isLoading } = useMiFitnessStatus();
  const invalidate = useInvalidateRuns();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [showManual, setShowManual] = useState(false);

  const onConnected = async (imported: number | null) => {
    toast({
      title: "Mi Fitness collegato",
      description: imported ? `Importate ${imported} corse` : "Le corse arriveranno alla prossima sincronizzazione",
    });
    setShowManual(false);
    await invalidate();
  };
  const qrLogin = useQrLogin(onConnected);

  const sync = async () => {
    setBusy("sync");
    try {
      const res = await fetch("/api/integrations/mifitness/sync", { method: "POST" });
      if (!res.ok) throw new Error(await apiError(res, "Sincronizzazione non riuscita"));
      const { imported } = await res.json();
      toast({ title: "Sincronizzato", description: imported ? `${imported} corse aggiornate` : "Nessuna corsa nuova" });
    } catch (error) {
      toast({ title: "Mi Fitness", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
      await invalidate();
    }
  };

  const disconnect = async () => {
    if (!confirm("Scollegare Mi Fitness? Le corse già importate restano.")) return;
    setBusy("disconnect");
    await fetch("/api/integrations/mifitness", { method: "DELETE" });
    setBusy(null);
    await invalidate();
  };

  const conn = data?.connection;
  const needsLogin = !conn || !!conn.lastError;

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF6900] text-white">
          <Watch className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Mi Fitness</p>
          <p className="truncate text-xs text-muted-foreground">
            {isLoading
              ? "…"
              : conn
                ? conn.lastSyncAt
                  ? `Sincronizzato ${formatDistanceToNow(new Date(conn.lastSyncAt), { locale: it, addSuffix: true })}`
                  : "Collegato"
                : "Le corse del tuo Xiaomi Watch, in automatico"}
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
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={sync} disabled={!!busy}>
            {busy === "sync" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Sincronizza
          </Button>
          <Button variant="outline" onClick={disconnect} disabled={!!busy}>
            Scollega
          </Button>
        </div>
      )}

      {needsLogin && !qrLogin.qr && (
        <>
          <Button className="mt-4 w-full bg-[#FF6900] text-white hover:bg-[#FF6900]/90" onClick={qrLogin.start} disabled={qrLogin.starting}>
            {qrLogin.starting && <Loader2 className="animate-spin" />}
            {conn ? "Ricollega account Xiaomi" : "Collega account Xiaomi"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Accedi con il tuo account Xiaomi sulla pagina ufficiale: BodyGrowth non vede la password e salva solo un
            token cifrato, revocabile dal centro sicurezza Xiaomi.
          </p>
        </>
      )}

      {qrLogin.qr && (
        <div className="mt-4 space-y-3 text-center">
          {qrLogin.qr.loginUrl && (
            <Button asChild className="w-full bg-[#FF6900] text-white hover:bg-[#FF6900]/90">
              <a href={qrLogin.qr.loginUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Accedi su Xiaomi
              </a>
            </Button>
          )}
          {qrLogin.qr.qrImage && (
            <>
              <p className="text-xs text-muted-foreground">Oppure inquadra il QR con l&apos;app Xiaomi Home o Mi Fitness</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrLogin.qr.qrImage} alt="QR di accesso Xiaomi" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
            </>
          )}
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> In attesa della conferma…
          </p>
          <button onClick={qrLogin.stop} className="h-10 text-xs text-muted-foreground">
            Annulla
          </button>
        </div>
      )}

      {needsLogin && !qrLogin.qr && (
        <div className="mt-2">
          <button onClick={() => setShowManual((v) => !v)} className="h-10 text-xs text-muted-foreground underline-offset-2 active:underline">
            {showManual ? "Nascondi" : "Avanzate: collega con passToken"}
          </button>
          {showManual && <ManualToken onConnected={onConnected} />}
          {conn && (
            <button onClick={disconnect} disabled={!!busy} className="ml-4 h-10 text-xs text-muted-foreground active:text-destructive">
              Scollega
            </button>
          )}
        </div>
      )}
    </section>
  );
}
