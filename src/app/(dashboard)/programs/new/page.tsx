"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { ProgramBuilder } from "@/components/programs/program-builder";
import { toast } from "@/hooks/use-toast";
import type { ProgramInput } from "@/lib/program-schema";

export default function NewProgramPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (payload: ProgramInput) => {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed");
      return res.json();
    },
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      toast({ title: "Piano creato", description: program.name });
      router.replace(`/programs/${program.id}`);
    },
    onError: () => toast({ title: "Errore", description: "Impossibile creare il piano", variant: "destructive" }),
  });

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex items-center gap-2 pt-2">
        <Link href="/programs" aria-label="Indietro" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none">Nuovo piano</h1>
      </header>
      <ProgramBuilder
        submitLabel="Crea piano"
        submitting={create.isPending}
        onSubmit={(payload) => create.mutate(payload)}
        onCancel={() => router.push("/programs")}
      />
    </div>
  );
}
