"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useExerciseSearch } from "@/hooks/use-workout-session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMuscleColor, getMuscleLabel, getEquipmentLabel, cn } from "@/lib/utils";
import { Search, X, Dumbbell, Plus, Pencil } from "lucide-react";
import { CreateExerciseSheet } from "@/components/exercises/create-exercise-sheet";
import type { ExerciseSearchResult } from "@/types";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
];

interface Props {
  onSelect: (exercise: { id: string; name: string }) => void;
  onClose: () => void;
}

export function ExerciseSelector({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseSearchResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${h / 100}px`);
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    return () => vv?.removeEventListener("resize", update);
  }, []);

  const { data: exercises, isLoading } = useExerciseSearch(debouncedQuery, selectedMuscle);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border flex flex-col"
        style={{ height: "calc(var(--vh, 1vh) * 85)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Seleziona Esercizio</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditingExercise(null); setShowCreate(true); }} title="Crea esercizio">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca esercizi..."
              className="pl-9"
            />
          </div>

          {/* Muscle filter */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedMuscle(undefined)}
              className={cn(
                "shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                !selectedMuscle ? "bg-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:border-foreground"
              )}
            >
              Tutti
            </button>
            {MUSCLES.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMuscle(selectedMuscle === m ? undefined : m)}
                className={cn(
                  "shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
                  selectedMuscle === m
                    ? "border-transparent text-white"
                    : "border-border text-muted-foreground hover:border-foreground"
                )}
                style={selectedMuscle === m ? { background: getMuscleColor(m) } : {}}
              >
                {getMuscleLabel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 space-y-1">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground text-sm">Caricamento...</div>
          )}
          {!isLoading && !exercises?.length && (
            <div className="py-8 text-center">
              <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessun esercizio trovato</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setEditingExercise(null); setShowCreate(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Crea esercizio
              </Button>
            </div>
          )}
          {exercises?.map((exercise: ExerciseSearchResult) => (
            <div key={exercise.id} className="flex items-center gap-1">
              <button
                onClick={() => onSelect({ id: exercise.id, name: exercise.name })}
                className="flex-1 text-left p-3 rounded-xl hover:bg-muted/50 active:scale-[0.99] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{exercise.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {exercise.equipment?.slice(0, 2).map((eq: string) => (
                        <span key={eq} className="text-[10px] text-muted-foreground">{getEquipmentLabel(eq)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                    {exercise.muscleGroups?.slice(0, 2).map((m: string) => (
                      <span
                        key={m}
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: `${getMuscleColor(m)}20`, color: getMuscleColor(m) }}
                      >
                        {getMuscleLabel(m)}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
              {exercise.isCustom && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingExercise(exercise); setShowCreate(true); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {showCreate && (
          <CreateExerciseSheet
            exercise={editingExercise}
            onClose={() => { setShowCreate(false); setEditingExercise(null); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
