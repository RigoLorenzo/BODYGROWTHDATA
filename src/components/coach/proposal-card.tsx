"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PLAN_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { ProposalExercise, ProposalView } from "@/lib/coach/types";

const reps = (ex: ProposalExercise) => (ex.repsMin === ex.repsMax ? `${ex.repsMin}` : `${ex.repsMin}-${ex.repsMax}`);

const rest = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s}"` : s === 0 ? `${m}'` : `${m}'${String(s).padStart(2, "0")}"`;
};

interface Props {
  proposal: ProposalView;
  onChange: (proposal: ProposalView) => void;
}

/** Anteprima di un piano proposto dal Coach: diventa attivo solo con "Applica" */
export function ProposalCard({ proposal, onChange }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<number | null>(0);

  const act = useMutation({
    mutationFn: async (action: "apply" | "reject") => {
      const res = await fetch(`/api/coach/proposals/${proposal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; programId?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Operazione non riuscita");
      return { action, programId: body?.programId ?? null };
    },
    onSuccess: ({ action, programId }) => {
      onChange({ ...proposal, status: action === "apply" ? "applied" : "rejected", programId });
      if (action === "apply") {
        queryClient.invalidateQueries({ queryKey: ["programs"] });
        toast({ title: "Piano attivato", description: `${proposal.name} è il tuo nuovo piano.` });
      }
    },
    onError: (error) => toast({ title: "Errore", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="mt-3 overflow-hidden rounded-3xl border border-border/60 bg-card">
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="h-4 w-4" aria-hidden /> Proposta di piano
        </div>
        <h3 className="font-display text-2xl font-bold uppercase leading-tight">{proposal.name}</h3>
        <p className="text-sm text-muted-foreground">
          {proposal.frequency} giorni a settimana · {proposal.durationWeeks} settimane
        </p>
        {proposal.description && <p className="text-sm">{proposal.description}</p>}
        <p className="text-sm leading-relaxed">{proposal.rationale}</p>
      </div>

      <ul className="border-t border-border/60">
        {proposal.days.map((day, index) => (
          <li key={`${day.name}-${index}`} className="border-b border-border/40 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpen(open === index ? null : index)}
              aria-expanded={open === index}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left"
            >
              <span className="font-semibold">{day.name}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {day.exercises.length} esercizi
                <ChevronDown className={cn("h-4 w-4 transition-transform", open === index && "rotate-180")} aria-hidden />
              </span>
            </button>
            {open === index && (
              <ol className="space-y-2 px-4 pb-4">
                {day.exercises.map((ex, i) => (
                  <li key={`${ex.name}-${i}`} className="text-sm">
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {ex.sets}×{reps(ex)}
                      {ex.rpe ? ` · RPE ${ex.rpe}` : ""} · recupero {rest(ex.restSeconds)}
                    </span>
                    {ex.notes && <p className="text-xs text-muted-foreground">{ex.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>

      {proposal.warnings.length > 0 && proposal.status === "pending" && (
        <div className="flex gap-2 border-t border-border/60 bg-amber-500/10 px-4 py-3 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <ul className="space-y-1">
            {proposal.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border/60 p-4">
        {proposal.status === "pending" && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => act.mutate("apply")}
              disabled={act.isPending}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background disabled:opacity-50 active:scale-[0.98]"
            >
              {act.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              Applica e attiva il piano
            </button>
            <button
              type="button"
              onClick={() => act.mutate("reject")}
              disabled={act.isPending}
              className="h-11 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted"
            >
              Scarta
            </button>
          </div>
        )}
        {proposal.status === "applied" && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-green-600">
              <Check className="h-4 w-4" aria-hidden /> Piano attivo
            </span>
            <Link href={PLAN_PATH} className="text-sm font-semibold text-primary">
              Vai al piano
            </Link>
          </div>
        )}
        {proposal.status === "rejected" && <p className="text-sm text-muted-foreground">Proposta scartata.</p>}
      </div>
    </div>
  );
}
