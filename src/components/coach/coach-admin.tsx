"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AdminOverview } from "@/lib/coach/invites";

const ADMIN_KEY = ["coach", "admin"] as const;

const date = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;
const who = (p: { name: string | null; email: string | null }) => p.name || p.email || "Utente";

type Action =
  | { action: "grant" | "revoke"; userId: string }
  | { action: "create_invite"; label: string; maxUses: number; expiresInDays: number | null }
  | { action: "set_invite_disabled"; code: string; disabled: boolean };

/** Gestione del Coach: inviti, lista d'attesa e tester con i costi degli ultimi 30 giorni */
export function CoachAdmin() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery<AdminOverview>({
    queryKey: ADMIN_KEY,
    queryFn: async () => {
      const res = await fetch("/api/coach/admin");
      if (!res.ok) throw new Error("admin");
      return res.json();
    },
  });

  const act = useMutation({
    mutationFn: async (body: Action) => {
      const res = await fetch("/api/coach/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "Operazione non riuscita");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_KEY }),
    onError: (error) => toast({ title: "Errore", description: error.message, variant: "destructive" }),
  });

  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/invito/${code}`;
    await navigator.clipboard.writeText(link).catch(() => null);
    toast({ title: "Link copiato", description: link });
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-8 px-4 pb-10 pt-3">
      <div className="flex items-center gap-1">
        <Link href="/coach" aria-label="Torna al Coach" className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Gestione Coach</h1>
      </div>

      {isPending && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-label="Caricamento" />}
      {isError && <p className="text-sm text-destructive">Impossibile caricare i dati.</p>}

      {data && (
        <>
          <p className="rounded-3xl bg-muted/60 p-4 text-sm">
            Costo stimato del Coach negli ultimi 30 giorni (tutti, te compreso): <strong>{usd(data.totalCostUsd30d)}</strong>
            <span className="block text-xs text-muted-foreground">Stima dai token registrati. Il dato ufficiale è nella console di Anthropic.</span>
          </p>

          <NewInvite busy={act.isPending} onCreate={(input) => act.mutate({ action: "create_invite", ...input }, { onSuccess: (res) => res?.code && copyLink(res.code) })} />

          <Section title="Inviti" empty="Nessun invito creato." count={data.invites.length}>
            {data.invites.map((i) => {
              const expired = i.expiresAt ? new Date(i.expiresAt) <= new Date() : false;
              const active = !i.disabled && !expired && i.uses < i.maxUses;
              return (
                <Row key={i.code}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {i.code} · usato {i.uses}/{i.maxUses}
                      {i.expiresAt ? ` · scade ${date(i.expiresAt)}` : ""}
                      {!active ? " · non attivo" : ""}
                    </p>
                  </div>
                  {active && (
                    <button type="button" onClick={() => copyLink(i.code)} aria-label="Copia il link" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted">
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  <SmallButton disabled={act.isPending} onClick={() => act.mutate({ action: "set_invite_disabled", code: i.code, disabled: !i.disabled })}>
                    {i.disabled ? "Riattiva" : "Disattiva"}
                  </SmallButton>
                </Row>
              );
            })}
          </Section>

          <Section title="Lista d'attesa" empty="Nessuno in attesa." count={data.waitlist.length}>
            {data.waitlist.map((w) => (
              <Row key={w.userId}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{who(w)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {w.email} · dal {date(w.createdAt)}
                  </p>
                  {w.note && <p className="mt-1 text-sm">“{w.note}”</p>}
                </div>
                <SmallButton primary disabled={act.isPending} onClick={() => act.mutate({ action: "grant", userId: w.userId })}>
                  Dai accesso
                </SmallButton>
              </Row>
            ))}
          </Section>

          <Section title="Tester" empty="Ancora nessun tester." count={data.testers.length}>
            {data.testers.map((t) => (
              <Row key={t.userId}>
                <div className={cn("min-w-0 flex-1", t.revokedAt && "opacity-50")}>
                  <p className="truncate font-medium">{who(t)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.email} · {t.source === "invite" ? `invito ${t.inviteCode ?? ""}` : "da lista d'attesa"} · dal {date(t.grantedAt)}
                    {t.revokedAt ? ` · revocato ${date(t.revokedAt)}` : ""}
                  </p>
                  <p className="text-xs">
                    30 giorni: {t.messages30d} messaggi · {usd(t.costUsd30d)}
                  </p>
                </div>
                <SmallButton disabled={act.isPending} onClick={() => act.mutate({ action: t.revokedAt ? "grant" : "revoke", userId: t.userId })}>
                  {t.revokedAt ? "Riattiva" : "Revoca"}
                </SmallButton>
              </Row>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function NewInvite({ busy, onCreate }: { busy: boolean; onCreate: (input: { label: string; maxUses: number; expiresInDays: number | null }) => void }) {
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState<number | null>(14);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onCreate({ label: label.trim(), maxUses, expiresInDays: days });
        setLabel("");
      }}
      className="space-y-3 rounded-3xl border border-border/60 p-4"
    >
      <p className="font-semibold">Nuovo invito</p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={60}
        placeholder="Per chi è? es. Marco, amici palestra"
        aria-label="Per chi è l'invito"
        className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
      />
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Usi
          <select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="h-10 rounded-xl border border-border bg-background px-2">
            {[1, 3, 5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Scade
          <select
            value={days ?? 0}
            onChange={(e) => setDays(Number(e.target.value) || null)}
            className="h-10 rounded-xl border border-border bg-background px-2"
          >
            <option value={7}>tra 7 giorni</option>
            <option value={14}>tra 14 giorni</option>
            <option value={30}>tra 30 giorni</option>
            <option value={0}>mai</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy || !label.trim()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Crea e copia il link
      </button>
    </form>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} {count > 0 && `· ${count}`}
      </h2>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y divide-border/50">{children}</ul>}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center gap-2 py-3">{children}</li>;
}

function SmallButton({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 shrink-0 rounded-xl px-3 text-sm font-semibold disabled:opacity-40",
        primary ? "bg-foreground text-background" : "border border-border"
      )}
    >
      {children}
    </button>
  );
}
