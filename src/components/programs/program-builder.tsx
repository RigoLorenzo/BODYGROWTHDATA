"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExerciseSelector } from "@/components/session/exercise-selector";
import { cn } from "@/lib/utils";
import type { ProgramInput } from "@/lib/program-schema";

export interface BuilderExercise {
  exerciseId: string;
  name: string;
  nameIt?: string | null;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  rpe?: number | null;
  notes?: string | null;
}

export interface BuilderDay {
  id?: string;
  name: string;
  workoutType: string;
  exercises: BuilderExercise[];
}

export interface BuilderProgram {
  name: string;
  description: string;
  frequency: number;
  durationWeeks: number;
  splitType: string;
  days: BuilderDay[];
}

interface Props {
  initial?: BuilderProgram;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: ProgramInput) => void;
  onCancel: () => void;
}

const WORKOUT_TYPES = [
  { value: "PUSH", label: "Push" },
  { value: "PULL", label: "Pull" },
  { value: "LEGS", label: "Gambe" },
  { value: "UPPER", label: "Upper" },
  { value: "LOWER", label: "Lower" },
  { value: "FULL_BODY", label: "Full body" },
  { value: "CARDIO", label: "Cardio" },
  { value: "CUSTOM", label: "Altro" },
];

const SPLITS = [
  { value: "PPL", label: "PPL" },
  { value: "UPPER_LOWER", label: "Upper/Lower" },
  { value: "BRO_SPLIT", label: "Bro split" },
  { value: "FULL_BODY", label: "Full body" },
  { value: "ARNOLD", label: "Arnold" },
  { value: "CUSTOM", label: "Personalizzato" },
];

const EMPTY: BuilderProgram = {
  name: "",
  description: "",
  frequency: 3,
  durationWeeks: 8,
  splitType: "CUSTOM",
  days: [],
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Campo numerico comodo da telefono: si può svuotare mentre scrivi, si valida all'uscita */
function NumberField({
  label,
  value,
  min,
  max,
  optional,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  min: number;
  max: number;
  optional?: boolean;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value?.toString() ?? "");
  useEffect(() => setText(value?.toString() ?? ""), [value]);

  const commit = () => {
    const n = parseFloat(text.replace(",", "."));
    if (Number.isNaN(n)) {
      if (optional) onChange(null);
      else setText(value?.toString() ?? "");
      return;
    }
    onChange(clamp(n, min, max));
  };

  return (
    <label className="min-w-0">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={text}
        placeholder={optional ? "–" : undefined}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        className="mt-0.5 h-10 w-full rounded-lg bg-muted/50 text-center text-base font-semibold tabular-nums outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}

function ExerciseEditor({
  ex,
  index,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  ex: BuilderExercise;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (updates: Partial<BuilderExercise>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-3">
      <div className="flex items-start gap-2">
        <span className="pt-0.5 font-display text-base font-bold tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ex.nameIt ?? ex.name}</p>
          {ex.nameIt && <p className="truncate text-xs text-muted-foreground">{ex.name}</p>}
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            aria-label="Sposta su"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-muted disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Sposta giù"
            disabled={isLast}
            onClick={() => onMove(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-muted disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Rimuovi esercizio"
            onClick={onRemove}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-destructive/10 active:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1.5">
        <NumberField label="Serie" value={ex.sets} min={1} max={20} onChange={(v) => onChange({ sets: v ?? 1 })} />
        <NumberField
          label="Reps min"
          value={ex.repsMin}
          min={1}
          max={100}
          onChange={(v) => {
            const repsMin = v ?? 1;
            onChange({ repsMin, repsMax: Math.max(repsMin, ex.repsMax) });
          }}
        />
        <NumberField
          label="Reps max"
          value={ex.repsMax}
          min={1}
          max={100}
          onChange={(v) => {
            const repsMax = v ?? ex.repsMin;
            onChange({ repsMax, repsMin: Math.min(repsMax, ex.repsMin) });
          }}
        />
        <NumberField
          label="Rec. s"
          value={ex.restSeconds}
          min={0}
          max={600}
          onChange={(v) => onChange({ restSeconds: Math.round(v ?? 0) })}
        />
        <NumberField label="RPE" value={ex.rpe} min={1} max={10} optional onChange={(v) => onChange({ rpe: v })} />
      </div>

      <input
        value={ex.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Note (es. superset, presa, RIR)"
        maxLength={300}
        className="mt-2 h-10 w-full rounded-lg bg-muted/50 px-3 text-base outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

const toPayload = (p: BuilderProgram): ProgramInput => ({
  name: p.name.trim(),
  description: p.description.trim() || null,
  frequency: p.frequency,
  durationWeeks: p.durationWeeks,
  splitType: p.splitType as ProgramInput["splitType"],
  days: p.days.map((d) => ({
    id: d.id,
    name: d.name.trim(),
    workoutType: d.workoutType as ProgramInput["days"][number]["workoutType"],
    exercises: d.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      restSeconds: ex.restSeconds,
      rpe: ex.rpe ?? null,
      notes: ex.notes?.trim() || null,
    })),
  })),
});

/** Editor del piano: lo stesso per creare e per modificare */
export function ProgramBuilder({ initial, submitLabel, submitting, onSubmit, onCancel }: Props) {
  const [program, setProgram] = useState<BuilderProgram>(initial ?? EMPTY);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [pickerForDay, setPickerForDay] = useState<number | null>(null);
  const [confirmRemoveDay, setConfirmRemoveDay] = useState<number | null>(null);

  const initialJson = useMemo(() => JSON.stringify(initial ?? EMPTY), [initial]);
  const dirty = JSON.stringify(program) !== initialJson;
  const invalid = !program.name.trim() || program.days.some((d) => !d.name.trim());

  // Non perdere le modifiche chiudendo o ricaricando la pagina per sbaglio
  useEffect(() => {
    if (!dirty || submitting) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, submitting]);

  const set = (updates: Partial<BuilderProgram>) => setProgram((p) => ({ ...p, ...updates }));
  const updateDay = (dayIdx: number, fn: (d: BuilderDay) => BuilderDay) =>
    setProgram((p) => ({ ...p, days: p.days.map((d, i) => (i === dayIdx ? fn(d) : d)) }));

  const addDay = () =>
    setProgram((p) => ({
      ...p,
      days: [...p.days, { name: `G${p.days.length + 1} — `, workoutType: "CUSTOM", exercises: [] }],
    }));

  const removeDay = (dayIdx: number) => {
    setProgram((p) => ({ ...p, days: p.days.filter((_, i) => i !== dayIdx) }));
    setCollapsed(new Set());
    setConfirmRemoveDay(null);
  };

  const moveExercise = (dayIdx: number, exIdx: number, delta: -1 | 1) =>
    updateDay(dayIdx, (d) => {
      const exercises = [...d.exercises];
      const [moved] = exercises.splice(exIdx, 1);
      exercises.splice(exIdx + delta, 0, moved);
      return { ...d, exercises };
    });

  const addExercise = (dayIdx: number, picked: { id: string; name: string; nameIt?: string | null }) => {
    updateDay(dayIdx, (d) => {
      const last = d.exercises[d.exercises.length - 1];
      return {
        ...d,
        exercises: [
          ...d.exercises,
          {
            exerciseId: picked.id,
            name: picked.name,
            nameIt: picked.nameIt ?? null,
            sets: last?.sets ?? 3,
            repsMin: last?.repsMin ?? 8,
            repsMax: last?.repsMax ?? 12,
            restSeconds: last?.restSeconds ?? 90,
          },
        ],
      };
    });
    setPickerForDay(null);
  };

  const toggleDay = (dayIdx: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dayIdx)) next.delete(dayIdx);
      else next.add(dayIdx);
      return next;
    });

  return (
    <div className="space-y-4 pb-28">
      <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="program-name">Nome del piano</Label>
          <Input
            id="program-name"
            value={program.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="es. Multifrequenza 4x"
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="program-description">Descrizione</Label>
          <Textarea
            id="program-description"
            value={program.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Obiettivo, priorità, progressione..."
            rows={2}
            className="text-base"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>Frequenza</Label>
            <Select value={String(program.frequency)} onValueChange={(v) => set({ frequency: Number(v) })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}×/sett.</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Durata</Label>
            <Select value={String(program.durationWeeks)} onValueChange={(v) => set({ durationWeeks: Number(v) })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from(new Set([4, 6, 8, 10, 12, 16, 20, 24, program.durationWeeks]))
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} sett.</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Split</Label>
            <Select value={program.splitType} onValueChange={(v) => set({ splitType: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPLITS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {program.days.map((day, dayIdx) => {
        const isCollapsed = collapsed.has(dayIdx);
        const totalSets = day.exercises.reduce((sum, ex) => sum + ex.sets, 0);
        return (
          <section key={day.id ?? `new-${dayIdx}`} className="rounded-3xl border border-border/60 bg-card">
            <div className="flex items-center gap-2 p-4 pb-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={day.name}
                  onChange={(e) => updateDay(dayIdx, (d) => ({ ...d, name: e.target.value }))}
                  placeholder="Nome del giorno"
                  aria-label={`Nome giorno ${dayIdx + 1}`}
                  className={cn("h-11 text-base font-semibold", !day.name.trim() && "border-destructive")}
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={day.workoutType}
                    onValueChange={(v) => updateDay(dayIdx, (d) => ({ ...d, workoutType: v }))}
                  >
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WORKOUT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    {day.exercises.length} esercizi · {totalSets} serie
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={isCollapsed ? "Espandi giorno" : "Comprimi giorno"}
                  onClick={() => toggleDay(dayIdx)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
                >
                  {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  aria-label="Elimina giorno"
                  onClick={() => setConfirmRemoveDay(dayIdx)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground active:bg-destructive/10 active:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {confirmRemoveDay === dayIdx && (
              <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-2">
                <span className="text-xs">Eliminare questo giorno e i suoi esercizi?</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirmRemoveDay(null)}>
                    Annulla
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => removeDay(dayIdx)}>
                    Elimina
                  </Button>
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="space-y-2 px-4 pb-4">
                {day.exercises.map((ex, exIdx) => (
                  <ExerciseEditor
                    key={`${ex.exerciseId}-${exIdx}`}
                    ex={ex}
                    index={exIdx}
                    isFirst={exIdx === 0}
                    isLast={exIdx === day.exercises.length - 1}
                    onChange={(updates) =>
                      updateDay(dayIdx, (d) => ({
                        ...d,
                        exercises: d.exercises.map((e, j) => (j === exIdx ? { ...e, ...updates } : e)),
                      }))
                    }
                    onMove={(delta) => moveExercise(dayIdx, exIdx, delta)}
                    onRemove={() =>
                      updateDay(dayIdx, (d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) }))
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-dashed"
                  onClick={() => setPickerForDay(dayIdx)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Aggiungi esercizio
                </Button>
              </div>
            )}
          </section>
        );
      })}

      <Button type="button" variant="outline" className="h-12 w-full border-dashed" onClick={addDay}>
        <Plus className="mr-2 h-4 w-4" />
        Aggiungi giorno
      </Button>

      {/* Barra di salvataggio sopra la navigazione */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border/60 bg-background px-4 py-3 md:bottom-0 md:pl-64">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button type="button" variant="outline" className="h-12 flex-1" onClick={onCancel} disabled={submitting}>
            Annulla
          </Button>
          <Button
            type="button"
            className="h-12 flex-[2] font-semibold"
            disabled={submitting || invalid || (!!initial && !dirty)}
            onClick={() => onSubmit(toPayload(program))}
          >
            {submitting ? "Salvataggio..." : submitLabel}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {pickerForDay !== null && (
          <ExerciseSelector onSelect={(ex) => addExercise(pickerForDay, ex)} onClose={() => setPickerForDay(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
