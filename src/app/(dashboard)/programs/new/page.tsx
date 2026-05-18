"use client";

import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Plus, X, GripVertical, Dumbbell } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

interface PlanExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

interface PlanDay {
  dayIndex: number;
  name: string;
  workoutType: string;
  exercises: PlanExercise[];
}

interface ExerciseResult {
  id: string;
  name: string;
  primaryMuscle: string | null;
}

const WORKOUT_TYPE_LABELS = [
  { value: "PUSH", label: "Push" },
  { value: "PULL", label: "Pull" },
  { value: "LEGS", label: "Legs" },
  { value: "UPPER", label: "Upper Body" },
  { value: "LOWER", label: "Lower Body" },
  { value: "FULL_BODY", label: "Full Body" },
  { value: "CARDIO", label: "Cardio" },
  { value: "CUSTOM", label: "Personalizzato" },
];

function ExerciseSearch({ onSelect }: { onSelect: (ex: ExerciseResult) => void }) {
  const [q, setQ] = useState("");
  const { data } = useQuery<ExerciseResult[]>({
    queryKey: ["exercises", q],
    queryFn: async () => {
      const res = await fetch(`/api/exercises?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: q.length >= 1,
    staleTime: 60_000,
  });

  return (
    <div className="relative">
      <Input
        placeholder="Cerca esercizio..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="text-sm"
      />
      {q.length >= 1 && data && data.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {data.map((ex) => (
            <button
              key={ex.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
              onClick={() => { onSelect(ex); setQ(""); }}
            >
              <Dumbbell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{ex.name}</span>
              {ex.primaryMuscle && (
                <span className="text-[10px] text-muted-foreground ml-auto">{ex.primaryMuscle}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewProgramPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("3");
  const [durationWeeks, setDurationWeeks] = useState("8");
  const [splitType, setSplitType] = useState("CUSTOM");
  const [days, setDays] = useState<PlanDay[]>([]);

  const createMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      toast({ title: "Piano creato!", description: program.name });
      router.push("/programs");
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare il piano", variant: "destructive" });
    },
  });

  const addDay = () => {
    setDays((prev) => [
      ...prev,
      {
        dayIndex: prev.length,
        name: `Giorno ${prev.length + 1}`,
        workoutType: "CUSTOM",
        exercises: [],
      },
    ]);
  };

  const updateDay = (idx: number, updates: Partial<PlanDay>) => {
    setDays((prev) => prev.map((d, i) => i === idx ? { ...d, ...updates } : d));
  };

  const removeDay = (idx: number) => {
    setDays((prev) => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, dayIndex: i })));
  };

  const addExercise = (dayIdx: number, ex: ExerciseResult) => {
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx
        ? {
            ...d,
            exercises: [
              ...d.exercises,
              { exerciseId: ex.id, exerciseName: ex.name, sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90 },
            ],
          }
        : d
    ));
  };

  const updateExercise = (dayIdx: number, exIdx: number, updates: Partial<PlanExercise>) => {
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx
        ? { ...d, exercises: d.exercises.map((e, j) => j === exIdx ? { ...e, ...updates } : e) }
        : d
    ));
  };

  const removeExercise = (dayIdx: number, exIdx: number) => {
    setDays((prev) => prev.map((d, i) =>
      i === dayIdx ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) } : d
    ));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Inserisci un nome per il piano", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      frequency: parseInt(frequency),
      durationWeeks: parseInt(durationWeeks),
      splitType,
      days: days.map((d) => ({
        dayIndex: d.dayIndex,
        name: d.name,
        workoutType: d.workoutType,
        exercises: d.exercises.map((ex, idx) => ({
          exerciseId: ex.exerciseId,
          orderIndex: idx,
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          restSeconds: ex.restSeconds,
        })),
      })),
    });
  };

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4 pb-24">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/programs"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuovo Piano</h1>
          <p className="text-muted-foreground text-sm">Crea un programma strutturato</p>
        </div>
      </div>

      {/* Basic info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Informazioni Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome del piano *</Label>
            <Input placeholder="es. PPL Ipertrofia" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Textarea
              placeholder="Obiettivo, note, progressione..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Frequenza</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}×/sett.</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Durata</Label>
              <Select value={durationWeeks} onValueChange={setDurationWeeks}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 6, 8, 10, 12, 16].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} sett.</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Split</Label>
              <Select value={splitType} onValueChange={setSplitType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PPL">PPL</SelectItem>
                  <SelectItem value="UPPER_LOWER">Upper/Lower</SelectItem>
                  <SelectItem value="BRO_SPLIT">Bro Split</SelectItem>
                  <SelectItem value="FULL_BODY">Full Body</SelectItem>
                  <SelectItem value="ARNOLD">Arnold</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Days */}
      <div className="space-y-3">
        {days.map((day, dayIdx) => (
          <Card key={dayIdx} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={day.name}
                  onChange={(e) => updateDay(dayIdx, { name: e.target.value })}
                  className="flex-1 text-sm font-medium"
                  placeholder="Nome del giorno"
                />
                <Select value={day.workoutType} onValueChange={(v) => updateDay(dayIdx, { workoutType: v })}>
                  <SelectTrigger className="w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPE_LABELS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button onClick={() => removeDay(dayIdx)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Exercises */}
              {day.exercises.map((ex, exIdx) => (
                <div key={exIdx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{ex.exerciseName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">Serie:</span>
                      <input
                        type="number"
                        className="w-8 text-xs bg-transparent border-b border-border text-center"
                        value={ex.sets}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExercise(dayIdx, exIdx, { sets: parseInt(e.target.value) || 1 })}
                        min={1} max={20}
                      />
                      <span className="text-[10px] text-muted-foreground">Reps:</span>
                      <input
                        type="number"
                        className="w-8 text-xs bg-transparent border-b border-border text-center"
                        value={ex.repsMin}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExercise(dayIdx, exIdx, { repsMin: parseInt(e.target.value) || 1 })}
                        min={1} max={100}
                      />
                      <span className="text-[10px] text-muted-foreground">–</span>
                      <input
                        type="number"
                        className="w-8 text-xs bg-transparent border-b border-border text-center"
                        value={ex.repsMax}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExercise(dayIdx, exIdx, { repsMax: parseInt(e.target.value) || 1 })}
                        min={1} max={100}
                      />
                      <span className="text-[10px] text-muted-foreground">Rest:</span>
                      <input
                        type="number"
                        className="w-10 text-xs bg-transparent border-b border-border text-center"
                        value={ex.restSeconds}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExercise(dayIdx, exIdx, { restSeconds: parseInt(e.target.value) || 60 })}
                        min={0} max={600} step={15}
                      />
                      <span className="text-[10px] text-muted-foreground">s</span>
                    </div>
                  </div>
                  <button onClick={() => removeExercise(dayIdx, exIdx)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <ExerciseSearch onSelect={(ex) => addExercise(dayIdx, ex)} />
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full" onClick={addDay}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Giorno
        </Button>
      </div>

      {/* Save */}
      <div className="fixed bottom-20 md:bottom-4 left-0 right-0 px-4 max-w-2xl mx-auto">
        <Button
          className="w-full shadow-lg"
          onClick={handleSubmit}
          disabled={createMutation.isPending || !name.trim()}
        >
          {createMutation.isPending ? "Creazione..." : "Crea Piano"}
        </Button>
      </div>
    </div>
  );
}
