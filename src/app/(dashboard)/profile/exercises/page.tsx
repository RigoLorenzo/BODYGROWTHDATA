"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useExerciseSearch } from "@/hooks/use-workout-session";
import { CreateExerciseSheet } from "@/components/exercises/create-exercise-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Plus, Search, Pencil, Dumbbell } from "lucide-react";
import { getMuscleColor, getMuscleLabel, getEquipmentLabel, cn } from "@/lib/utils";
import type { ExerciseSearchResult } from "@/types";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "FOREARMS",
  "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE", "FULL_BODY",
];

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

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/profile/settings"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Esercizi</h1>
            <p className="text-sm text-muted-foreground">
              Libreria dell&apos;app e i tuoi esercizi personalizzati
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Nuovo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca in italiano o inglese..."
          className="pl-9 text-base"
          autoCorrect="off"
          autoCapitalize="none"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => { setMuscle(undefined); setOnlyCustom(false); }}
          className={cn(
            "shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
            !muscle && !onlyCustom ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground"
          )}
        >
          Tutti
        </button>
        <button
          onClick={() => { setOnlyCustom((v) => !v); }}
          className={cn(
            "shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
            onlyCustom ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground"
          )}
        >
          Solo i miei
        </button>
        {MUSCLES.map((m) => (
          <button
            key={m}
            onClick={() => setMuscle(muscle === m ? undefined : m)}
            className={cn(
              "shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
              muscle === m ? "border-transparent text-white" : "border-border text-muted-foreground"
            )}
            style={muscle === m ? { background: getMuscleColor(m) } : {}}
          >
            {getMuscleLabel(m)}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {isLoading ? "Caricamento..." : `${list.length} esercizi`}
      </p>

      <div className="space-y-1.5">
        {!isLoading && list.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="p-6 text-center">
              <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">Nessun esercizio trovato</p>
              <Button size="sm" variant="outline" onClick={() => { setEditing(null); setShowCreate(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Crea esercizio
              </Button>
            </CardContent>
          </Card>
        )}

        {list.map((ex: ExerciseSearchResult) => (
          <Card key={ex.id} className="border-border/40">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{ex.nameIt ?? ex.name}</p>
                  {ex.isCustom && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      Personalizzato
                    </span>
                  )}
                </div>
                {ex.nameIt && <p className="text-xs text-muted-foreground">{ex.name}</p>}
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {ex.muscleGroups?.slice(0, 3).map((m: string) => (
                    <span
                      key={m}
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: `${getMuscleColor(m)}20`, color: getMuscleColor(m) }}
                    >
                      {getMuscleLabel(m)}
                    </span>
                  ))}
                  {ex.equipment?.slice(0, 2).map((eq: string) => (
                    <span key={eq} className="text-[10px] text-muted-foreground">
                      {getEquipmentLabel(eq)}
                    </span>
                  ))}
                </div>
              </div>
              {ex.isCustom && (
                <button
                  onClick={() => { setEditing(ex); setShowCreate(true); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                  aria-label="Modifica esercizio"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
