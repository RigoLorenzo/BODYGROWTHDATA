"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Copy, Pencil, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useStartPlanDay } from "@/hooks/use-active-program";
import { getMuscleColor, getMuscleLabel } from "@/lib/utils";
import { plannedMuscleVolume, repsLabel, splitDayName } from "@/lib/plan-format";
import type { ProgramDetail } from "@/types";

const SPLIT_LABELS: Record<string, string> = {
  PPL: "Push/Pull/Legs",
  UPPER_LOWER: "Upper/Lower",
  BRO_SPLIT: "Bro split",
  FULL_BODY: "Full body",
  ARNOLD: "Arnold",
  CUSTOM: "Personalizzato",
};

const formatRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}'${s % 60 ? `${s % 60}"` : ""}` : `${s}"`);

const fmtSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/**
 * Serie settimanali per muscolo, con lo stesso modello di Analytics:
 * la parte piena sono le serie dirette, quella chiara il contributo
 * degli esercizi in cui il muscolo lavora da secondario.
 */
function WeeklyVolume({ program }: { program: ProgramDetail }) {
  const muscles = plannedMuscleVolume(program.days.flatMap((d) => d.exercises));
  if (!muscles.length) return null;
  const max = muscles[0][1].weighted;
  const totalSets = program.days.reduce((sum, d) => sum + d.exercises.reduce((s, ex) => s + ex.sets, 0), 0);

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Serie a settimana</h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-display text-xl font-bold tabular-nums text-foreground">{totalSets}</span> totali
        </p>
      </div>
      <ul className="mt-3 space-y-2.5">
        {muscles.map(([muscle, { direct, weighted }]) => (
          <li key={muscle} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3">
            <span className="truncate text-sm">{getMuscleLabel(muscle)}</span>
            <span className="relative h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className="absolute inset-y-0 left-0 rounded-full opacity-35"
                style={{ width: `${(weighted / max) * 100}%`, background: getMuscleColor(muscle) }}
              />
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(direct / max) * 100}%`, background: getMuscleColor(muscle) }}
              />
            </span>
            <span className="text-right leading-none">
              <span className="font-display text-lg font-bold tabular-nums">{fmtSets(weighted)}</span>
              {weighted !== direct && (
                <span className="block text-[10px] tabular-nums text-muted-foreground">{direct} dirette</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Parte piena: serie dirette. Parte chiara: lavoro da muscolo secondario (vale ½ o ¼ di serie), come in Analytics.
      </p>
    </section>
  );
}

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { startDay, isLoading: starting } = useStartPlanDay();

  const { data: program, isPending, isError } = useQuery<ProgramDetail>({
    queryKey: ["programs", id],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/programs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: id }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      toast({ title: "Piano attivato", description: "Ora è il piano della home." });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile attivare il piano", variant: "destructive" }),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/programs/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return (await res.json()) as { id: string; name: string };
    },
    onSuccess: (copy) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      toast({ title: "Piano duplicato", description: copy.name });
      router.push(`/programs/${copy.id}/edit`);
    },
    onError: () => toast({ title: "Errore", description: "Impossibile duplicare il piano", variant: "destructive" }),
  });

  if (isPending) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="container mx-auto max-w-2xl p-4 pt-8 text-center">
        <p className="text-sm text-muted-foreground">Piano non trovato.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/programs">Torna ai piani</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-4 pb-8">
      <header className="pt-2">
        <div className="flex items-center justify-between">
          <Link
            href="/programs"
            aria-label="Tutti i piani"
            className="-ml-2 flex h-10 items-center gap-1 rounded-full pr-3 pl-1 text-sm text-muted-foreground active:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" /> Piani
          </Link>
          {program.isActive && (
            <span className="rounded-full bg-lime-400/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-lime-700 dark:text-lime-400">
              Piano attivo
            </span>
          )}
        </div>
        <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-[0.95]">{program.name}</h1>
        {program.description && <p className="mt-2 text-sm text-muted-foreground">{program.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {[
            `${program.frequency}× a settimana`,
            `${program.durationWeeks} settimane`,
            SPLIT_LABELS[program.splitType] ?? program.splitType,
            `${program.days.length} giorni`,
          ].map((chip) => (
            <span key={chip} className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {chip}
            </span>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button asChild className="h-12 flex-1 font-semibold">
            <Link href={`/programs/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Modifica piano
            </Link>
          </Button>
          {!program.isActive && (
            <Button
              variant="outline"
              className="h-12 flex-1"
              onClick={() => activate.mutate()}
              disabled={activate.isPending}
            >
              <Zap className="mr-2 h-4 w-4" /> {activate.isPending ? "Attivazione..." : "Rendi attivo"}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          className="mt-1 h-11 w-full text-muted-foreground"
          onClick={() => duplicate.mutate()}
          disabled={duplicate.isPending}
        >
          <Copy className="mr-2 h-4 w-4" />
          {duplicate.isPending ? "Duplicazione..." : "Duplica per creare una variante"}
        </Button>
      </header>

      <WeeklyVolume program={program} />

      {program.days.map((day, index) => {
        const { code, title } = splitDayName(day.name, index);
        const totalSets = day.exercises.reduce((sum, ex) => sum + ex.sets, 0);
        return (
          <section key={day.id} className="overflow-hidden rounded-3xl border border-border/60 bg-card">
            <div className="flex items-end gap-3 p-5 pb-3">
              <span className="font-display text-5xl font-extrabold uppercase leading-[0.8]">{code}</span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold uppercase leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {day.exercises.length} esercizi · {totalSets} serie
                </p>
              </div>
            </div>

            <ol className="border-t border-border/50">
              {day.exercises.map((ex, i) => (
                <li key={ex.id} className="flex gap-3 border-b border-border/40 px-5 py-3 last:border-0">
                  <span className="pt-0.5 font-display text-sm font-bold tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{ex.exercise?.nameIt ?? ex.exercise?.name}</p>
                    {ex.exercise?.nameIt && (
                      <p className="text-xs leading-tight text-muted-foreground">{ex.exercise.name}</p>
                    )}
                    {ex.notes && <p className="mt-1 text-xs text-primary/80">{ex.notes}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-bold leading-tight tabular-nums">
                      {ex.sets}×{repsLabel(ex.repsMin, ex.repsMax)}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      rec. {formatRest(ex.restSeconds)}
                      {ex.rpe ? ` · RPE ${ex.rpe}` : ""}
                    </p>
                  </div>
                </li>
              ))}
              {day.exercises.length === 0 && (
                <li className="px-5 py-4 text-sm text-muted-foreground">Nessun esercizio: aggiungili da Modifica.</li>
              )}
            </ol>

            {day.exercises.length > 0 && (
              <div className="p-3">
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => startDay(day)}
                  disabled={starting}
                >
                  <Play className="mr-2 h-4 w-4" /> Allena {code}
                </Button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
