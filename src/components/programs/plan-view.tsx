"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProgram } from "@/hooks/use-active-program";
import { ProgramView } from "./program-view";

/** Senza piano attivo: sceglierne uno o crearne uno nuovo */
function NoActivePlan() {
  return (
    <div className="container mx-auto max-w-xl space-y-6 px-4 pb-6 pt-3">
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Piano</h1>
      <div className="rounded-3xl bg-muted/60 p-6 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-semibold">Nessun piano attivo</p>
        <p className="mt-1 text-sm text-muted-foreground">Attivane uno per vederlo qui e allenarti dalla home.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/programs" className="flex h-12 items-center justify-center rounded-2xl bg-foreground text-sm font-semibold text-background active:scale-[0.98]">
            Scegli un piano
          </Link>
          <Link href="/programs/new" className="flex h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-medium text-muted-foreground active:bg-muted">
            <Plus className="h-4 w-4" aria-hidden /> Crea un piano
          </Link>
        </div>
      </div>
    </div>
  );
}

/** La sezione Piano: il piano attivo per intero, con il prossimo giorno in evidenza */
export function PlanView() {
  const { data: active, isPending } = useActiveProgram();

  if (isPending) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }
  if (!active?.programId) return <NoActivePlan />;

  const total = active.program.durationWeeks;
  return (
    <ProgramView
      id={active.programId}
      variant="plan"
      weekLabel={`Piano · Settimana ${Math.min(active.weekProgress, total)} di ${total}`}
      nextDayIndex={active.suggestedDayIndex ?? undefined}
    />
  );
}
