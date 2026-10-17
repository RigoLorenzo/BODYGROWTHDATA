"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { ProgramBuilder, type BuilderProgram } from "@/components/programs/program-builder";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { ProgramInput } from "@/lib/program-schema";
import type { ProgramDetail } from "@/types";

const toBuilder = (p: ProgramDetail): BuilderProgram => ({
  name: p.name,
  description: p.description ?? "",
  frequency: p.frequency,
  durationWeeks: p.durationWeeks,
  splitType: p.splitType,
  days: p.days.map((d) => ({
    id: d.id,
    name: d.name,
    workoutType: d.workoutType,
    exercises: d.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.exercise?.name ?? "Esercizio rimosso",
      nameIt: ex.exercise?.nameIt ?? null,
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      restSeconds: ex.restSeconds,
      rpe: ex.rpe,
      notes: ex.notes ?? null,
    })),
  })),
});

export default function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: program, isPending, isError } = useQuery<ProgramDetail>({
    queryKey: ["programs", id],
    queryFn: async () => {
      const res = await fetch(`/api/programs/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    // L'editor parte dai dati del momento e non deve cambiare sotto le dita
    staleTime: Infinity,
    refetchOnMount: "always",
  });

  const initial = useMemo(() => (program ? toBuilder(program) : undefined), [program]);

  const save = useMutation({
    mutationFn: async (payload: ProgramInput) => {
      const res = await fetch(`/api/programs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      toast({ title: "Piano aggiornato" });
      router.replace(`/programs/${id}`);
    },
    onError: () => toast({ title: "Errore", description: "Impossibile salvare il piano", variant: "destructive" }),
  });

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Link
          href={`/programs/${id}`}
          aria-label="Indietro"
          className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none">Modifica piano</h1>
      </header>

      {isPending && <Skeleton className="h-96 rounded-3xl" />}
      {isError && <p className="text-sm text-muted-foreground">Piano non trovato.</p>}
      {initial && (
        <ProgramBuilder
          initial={initial}
          submitLabel="Salva modifiche"
          submitting={save.isPending}
          onSubmit={(payload) => save.mutate(payload)}
          onCancel={() => router.push(`/programs/${id}`)}
        />
      )}
    </div>
  );
}
