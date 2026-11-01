"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useExerciseSearch } from "@/hooks/use-workout-session";
import { CreateExerciseSheet } from "@/components/exercises/create-exercise-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Plus, Search, Pencil, Dumbbell } from "lucide-react";
import { getMuscleColor, getMuscleLabel, getEquipmentLabel, cn } from "@/lib/utils";
import type { ExerciseSearchResult } from "@/types";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "FOREARMS",
  "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE", "FULL_BODY",
];

const CHIP = "flex h-9 shrink-0 touch-manipulation items-center rounded-full px-3.5 text-[13px] font-medium transition-colors";

/** Libreria esercizi: consultazione, creazione e modifica dei propri esercizi. */
export default function ExercisesPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [muscle, setMuscle] = useState<string | undefined>();
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ExerciseSearchResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: exercises, isLoading } = useExerciseSearch(debouncedQuery, muscle);
  const list = (exercises ?? []).filter((ex: ExerciseSearchResult) => !onlyCustom || ex.isCustom);

  const openCreate = () => {
    setEditing(null);
    setShowCreate(true);
  };

  return (
    <div className="container mx-auto max-w-xl space-y-4 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/profile/settings"
          aria-label="Indietro"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 font-display text-3xl font-bold uppercase tracking-wide">Esercizi</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-lime-400 px-4 font-display text-base font-bold uppercase tracking-wide text-zinc-950 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Nuovo
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca in italiano o inglese…"
          aria-label="Cerca esercizi"
          className="h-12 rounded-2xl border-border/60 bg-card pl-10 text-base"
          autoCorrect="off"
          autoCapitalize="none"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
        <button
          type="button"
          aria-pressed={!muscle && !onlyCustom}
          onClick={() => { setMuscle(undefined); setOnlyCustom(false); }}
          className={cn(CHIP, !muscle && !onlyCustom ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
        >
          Tutti
        </button>
        <button
          type="button"
          aria-pressed={onlyCustom}
          onClick={() => setOnlyCustom((v) => !v)}
          className={cn(CHIP, onlyCustom ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}
        >
          Solo i miei
        </button>
        {MUSCLES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={muscle === m}
            onClick={() => setMuscle(muscle === m ? undefined : m)}
            className={cn(CHIP, "gap-1.5", muscle === m ? "text-white" : "bg-muted text-muted-foreground")}
            style={muscle === m ? { background: getMuscleColor(m) } : {}}
          >
            {muscle !== m && <span className="h-2 w-2 rounded-full" style={{ background: getMuscleColor(m) }} aria-hidden />}
            {getMuscleLabel(m)}
          </button>
        ))}
      </div>

      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" aria-live="polite">
        {isLoading ? "Caricamento…" : `${list.length} esercizi`}
      </p>

      {isLoading ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 p-8 text-center">
          <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="mb-4 text-sm text-muted-foreground">Nessun esercizio trovato</p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Crea esercizio
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl border border-border/60 bg-card">
          {list.map((ex: ExerciseSearchResult) => {
            const color = getMuscleColor(ex.primaryMuscle ?? ex.muscleGroups?.[0] ?? "FULL_BODY");
            const details = [
              ...(ex.muscleGroups?.slice(0, 2).map((m: string) => getMuscleLabel(m)) ?? []),
              ...(ex.equipment?.slice(0, 1).map((eq: string) => getEquipmentLabel(eq)) ?? []),
            ];
            return (
              <li key={ex.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{ex.nameIt ?? ex.name}</span>
                    {ex.isCustom && (
                      <span className="shrink-0 rounded-full bg-lime-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-700 dark:text-[#d4ff3a]">
                        Mio
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[ex.nameIt ? ex.name : null, ...details].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {ex.isCustom && (
                  <button
                    type="button"
                    onClick={() => { setEditing(ex); setShowCreate(true); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                    aria-label={`Modifica ${ex.nameIt ?? ex.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateExerciseSheet
            exercise={editing}
            onClose={() => { setShowCreate(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
