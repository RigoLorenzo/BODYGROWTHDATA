"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useExerciseSearch } from "@/hooks/use-workout-session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMuscleColor, getMuscleLabel, getEquipmentLabel } from "@/lib/utils";
import { Search, X, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS", "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
];

interface Props {
  onSelect: (exercise: { id: string; name: string }) => void;
  onClose: () => void;
}

export function ExerciseSelector({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: exercises, isLoading } = useExerciseSearch(query, selectedMuscle);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Seleziona Esercizio</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
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
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 pb-8 space-y-1">
            {isLoading && (
              <div className="py-8 text-center text-muted-foreground text-sm">Caricamento...</div>
            )}
            {!isLoading && !exercises?.length && (
              <div className="py-8 text-center">
                <Dumbbell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nessun esercizio trovato</p>
              </div>
            )}
            {exercises?.map((exercise: any) => (
              <button
                key={exercise.id}
                onClick={() => onSelect({ id: exercise.id, name: exercise.name })}
                className="w-full text-left p-3 rounded-xl hover:bg-muted/50 active:scale-[0.99] transition-all"
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
            ))}
          </div>
        </ScrollArea>
      </motion.div>
    </motion.div>
  );
}
