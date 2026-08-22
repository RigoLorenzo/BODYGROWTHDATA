"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Trash2 } from "lucide-react";
import { getMuscleColor, getMuscleLabel, getEquipmentLabel, cn } from "@/lib/utils";
import { useCreateExercise, useUpdateExercise, useDeleteExercise } from "@/hooks/use-workout-session";
import type { ExerciseSearchResult } from "@/types";

const MUSCLES = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS",
  "QUADS", "HAMSTRINGS", "GLUTES", "CORE", "CALVES",
];

const CATEGORIES = [
  { value: "COMPOUND", label: "Compound" },
  { value: "ISOLATION", label: "Isolamento" },
  { value: "CARDIO", label: "Cardio" },
  { value: "STRETCHING", label: "Stretching" },
];

const EQUIPMENT_OPTIONS = [
  "BARBELL", "DUMBBELL", "MACHINE", "CABLE",
  "BODYWEIGHT", "KETTLEBELL", "BANDS", "OTHER",
];

interface Props {
  exercise?: ExerciseSearchResult | null;
  onClose: () => void;
}

export function CreateExerciseSheet({ exercise, onClose }: Props) {
  const isEdit = !!exercise;

  const [name, setName] = useState(exercise?.name ?? "");
  const [nameIt, setNameIt] = useState(exercise?.nameIt ?? "");
  const [primaryMuscle, setPrimaryMuscle] = useState(exercise?.primaryMuscle ?? "");
  const [muscleGroups, setMuscleGroups] = useState<string[]>(exercise?.muscleGroups ?? []);
  const [category, setCategory] = useState(exercise?.category ?? "COMPOUND");
  const [equipment, setEquipment] = useState<string[]>(exercise?.equipment ?? []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; offsetTop: number } | null>(null);

  // Con la tastiera aperta il pannello si adatta all'area visibile
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () =>
      setViewport({ height: vv?.height ?? window.innerHeight, offsetTop: vv?.offsetTop ?? 0 });
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  const createMutation = useCreateExercise();
  const updateMutation = useUpdateExercise();
  const deleteMutation = useDeleteExercise();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const toggleMuscle = (m: string) => {
    setMuscleGroups((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const toggleEquipment = (eq: string) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((x) => x !== eq) : [...prev, eq]
    );
  };

  const handleSave = () => {
    if (!name.trim() || !primaryMuscle) return;
    const payload = {
      name: name.trim(),
      nameIt: nameIt.trim(),
      primaryMuscle,
      muscleGroups: Array.from(new Set([primaryMuscle, ...muscleGroups])),
      category,
      equipment,
    };
    if (isEdit && exercise) {
      updateMutation.mutate({ id: exercise.id, ...payload }, { onSuccess: onClose });
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  };

  const handleDelete = () => {
    if (!exercise) return;
    deleteMutation.mutate(exercise.id, { onSuccess: onClose });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed left-0 right-0 top-0 bg-card sm:rounded-t-2xl border-t border-border flex flex-col"
        style={{
          height: viewport ? `${viewport.height}px` : "100dvh",
          transform: viewport ? `translateY(${viewport.offsetTop}px)` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <h2 className="font-semibold">{isEdit ? "Modifica Esercizio" : "Crea Esercizio"}</h2>
          <div className="flex items-center gap-1">
            {isEdit && (
              <Button variant="ghost" size="icon-sm" onClick={() => setShowDeleteConfirm(true)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Nome (inglese) *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Barbell Bench Press"
              className="text-base"
              autoFocus={!isEdit}
            />
          </div>

          {/* Nome italiano */}
          <div className="space-y-1.5">
            <Label>Nome italiano</Label>
            <Input
              value={nameIt}
              onChange={(e) => setNameIt(e.target.value)}
              placeholder="Es. Panca piana con bilanciere"
              className="text-base"
            />
          </div>

          {/* Primary muscle */}
          <div className="space-y-2">
            <Label>Muscolo Principale *</Label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPrimaryMuscle(m)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    primaryMuscle === m
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:border-foreground"
                  )}
                  style={primaryMuscle === m ? { background: getMuscleColor(m) } : {}}
                >
                  {getMuscleLabel(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary muscles */}
          <div className="space-y-2">
            <Label>Muscoli Secondari</Label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.filter((m) => m !== primaryMuscle).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMuscle(m)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    muscleGroups.includes(m)
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:border-foreground"
                  )}
                  style={muscleGroups.includes(m) ? { background: `${getMuscleColor(m)}99` } : {}}
                >
                  {getMuscleLabel(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    category === cat.value
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "border-border text-muted-foreground hover:border-foreground"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div className="space-y-2">
            <Label>Attrezzatura</Label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => toggleEquipment(eq)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-colors",
                    equipment.includes(eq)
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "border-border text-muted-foreground hover:border-foreground"
                  )}
                >
                  {getEquipmentLabel(eq)}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={!name.trim() || !primaryMuscle || isPending}
          >
            {isPending ? "Salvataggio..." : isEdit ? "Salva Modifiche" : "Crea Esercizio"}
          </Button>
        </div>

        {/* Delete confirm overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-10 flex items-end bg-black/40 rounded-t-2xl">
            <div className="w-full bg-card border-t border-border p-6 rounded-t-2xl space-y-3">
              <h3 className="font-bold">Eliminare l&apos;esercizio?</h3>
              <p className="text-sm text-muted-foreground">
                Questa azione non può essere annullata.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={deleteMutation.isPending}
                  onClick={handleDelete}
                >
                  {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
