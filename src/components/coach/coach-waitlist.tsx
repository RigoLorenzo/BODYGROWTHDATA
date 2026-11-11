"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, Ticket } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FEATURES = [
  { title: "Ti crea il piano in pochi minuti", text: "Rispondi a qualche domanda e il piano è pronto, con esercizi, serie e recuperi." },
  { title: "Conosce ogni tuo numero", text: "«Quante serie di petto ho fatto quest'anno?» Ti risponde con i tuoi dati veri." },
  { title: "Ricorda tutta la tua storia", text: "Sa quando hai cambiato piano e ti dice cosa ha funzionato in ogni periodo." },
  { title: "Fa le domande giuste", text: "Se manca qualcosa (giorni, tempo, attrezzatura) te lo chiede prima di decidere." },
  { title: "Aggiorna il piano con te", text: "Ti propone le modifiche e tu approvi con un tocco." },
];

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? "Operazione non riuscita");
  return data;
}

/** Il Coach per chi non ha ancora accesso: cosa fa, lista d'attesa e codice d'invito */
export function CoachWaitlist({ waitlisted: initial }: { waitlisted: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [waitlisted, setWaitlisted] = useState(initial);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"join" | "leave" | "code" | null>(null);

  const join = async () => {
    setBusy("join");
    try {
      await post("/api/coach/waitlist", { note: note.trim() || null });
      setWaitlisted(true);
    } catch (error) {
      toast({ title: "Errore", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    setBusy("leave");
    await fetch("/api/coach/waitlist", { method: "DELETE" }).catch(() => null);
    setWaitlisted(false);
    setBusy(null);
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy("code");
    try {
      await post("/api/coach/invites/redeem", { code });
      toast({ title: "Coach attivato", description: "Benvenuto tra i tester!" });
      queryClient.invalidateQueries({ queryKey: ["coach", "access"] });
      router.refresh();
    } catch (error) {
      toast({ title: "Codice non valido", description: (error as Error).message, variant: "destructive" });
      setBusy(null);
    }
  };

  return (
    <div className="container mx-auto max-w-xl space-y-6 px-4 pb-8 pt-3">
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Coach</h1>

      <section className="space-y-2">
        <Sparkles className="h-7 w-7 text-primary" aria-hidden />
        <h2 className="text-2xl font-semibold leading-tight">Il tuo personal trainer. Sempre con te.</h2>
        <p className="text-sm text-muted-foreground">
          Dimmi cosa vuoi ottenere: il Coach legge i tuoi allenamenti, ti fa le domande giuste e ti prepara il piano. Poi ti
          segue, settimana dopo settimana.
        </p>
      </section>

      <ul className="space-y-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-semibold">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="space-y-3 rounded-3xl bg-muted/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In arrivo · beta su invito</p>
        {waitlisted ? (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <Check className="h-5 w-5 text-green-600" aria-hidden /> Sei nella lista d&apos;attesa
            </p>
            <p className="text-sm text-muted-foreground">
              Quando ti diamo l&apos;accesso, il Coach si attiva da solo qui. Non devi fare altro.
            </p>
            <button
              type="button"
              onClick={leave}
              disabled={busy !== null}
              className="text-sm font-medium text-muted-foreground underline underline-offset-2"
            >
              Esci dalla lista
            </button>
          </>
        ) : (
          <>
            <p className="text-sm">Lo stiamo provando con pochi tester. Mettiti in lista e ti facciamo entrare appena possibile.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Cosa vorresti dal Coach? (facoltativo)"
              aria-label="Cosa vorresti dal Coach"
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
            <button
              type="button"
              onClick={join}
              disabled={busy !== null}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background disabled:opacity-50 active:scale-[0.98]"
            >
              {busy === "join" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Entra nella lista d&apos;attesa
            </button>
          </>
        )}
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4" aria-hidden /> Hai un codice invito?
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            redeem();
          }}
          className="flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            placeholder="ABCD2345"
            aria-label="Codice invito"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 font-mono text-base tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={busy !== null || !code.trim()}
            className="flex h-12 items-center gap-2 rounded-2xl border border-border px-5 text-sm font-semibold disabled:opacity-40"
          >
            {busy === "code" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Attiva
          </button>
        </form>
      </section>
    </div>
  );
}
