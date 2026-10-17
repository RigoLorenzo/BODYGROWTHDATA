"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { getMuscleColor, getMuscleLabel, formatVolume, cn } from "@/lib/utils";
import { Trophy, TrendingUp, ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface PR {
  id: string;
  recordType: string;
  value: number;
  reps?: number | null;
  weight?: number | null;
  dateAchieved: string;
  previousRecord?: number | null;
  improvementPercent?: number | null;
}

interface ExerciseGroup {
  exerciseId: string;
  exercise: { name: string; nameIt?: string | null; primaryMuscle: string | null };
  records: PR[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; format: (v: number, r?: number | null, w?: number | null) => string }> = {
  WEIGHT:  { label: "Peso max",    color: "text-blue-600 dark:text-blue-400",   format: (v) => `${v}kg` },
  REPS:    { label: "Ripetizioni max", color: "text-green-600 dark:text-green-400",  format: (v) => `${v} reps` },
  VOLUME:  { label: "Volume max",  color: "text-purple-600 dark:text-purple-400", format: (v) => formatVolume(v) },
  ONE_RM:  { label: "1RM stimato", color: "text-orange-600 dark:text-orange-400", format: (v) => `${v}kg` },
};

const byType = (group: ExerciseGroup, type: string) => group.records.find((r) => r.recordType === type);

/** Riga compatta: il massimale stimato in evidenza, il resto al tocco */
function RecordRow({ group }: { group: ExerciseGroup }) {
  const [open, setOpen] = useState(false);
  const oneRm = byType(group, "ONE_RM");
  const weight = byType(group, "WEIGHT");
  const latest = group.records[0];
  const muscle = group.exercise.primaryMuscle;

  return (
    <li className="border-b border-border/50 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/50 touch-manipulation"
      >
        <span
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ background: muscle ? getMuscleColor(muscle) : "hsl(var(--muted))" }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{group.exercise.nameIt ?? group.exercise.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {muscle ? `${getMuscleLabel(muscle)} · ` : ""}
            {format(new Date(latest.dateAchieved), "d MMM", { locale: it })}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-xl font-bold tabular-nums leading-tight">
            {oneRm ? `${Math.round(oneRm.value)} kg` : weight ? `${weight.value} kg` : "—"}
          </span>
          <span className="block text-[11px] text-muted-foreground">{oneRm ? "1RM stimato" : "peso max"}</span>
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          {group.records.map((pr) => {
            const cfg = TYPE_CONFIG[pr.recordType];
            if (!cfg) return null;
            return (
              <div key={pr.id} className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className={`text-lg font-bold tabular-nums ${cfg.color}`}>{cfg.format(pr.value, pr.reps, pr.weight)}</p>
                <p className="flex items-center justify-between text-xs text-muted-foreground">
                  {format(new Date(pr.dateAchieved), "d MMM yyyy", { locale: it })}
                  {pr.improvementPercent != null && pr.improvementPercent > 0 && (
                    <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                      <TrendingUp className="h-3 w-3" />+{pr.improvementPercent.toFixed(1)}%
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

export default function RecordsPage() {
  const [search, setSearch] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ExerciseGroup[]>({
    queryKey: ["records"],
    queryFn: async () => {
      const res = await fetch("/api/records");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const muscles = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.forEach((g) => { if (g.exercise.primaryMuscle) set.add(g.exercise.primaryMuscle); });
    return Array.from(set);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((group) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q || group.exercise.name.toLowerCase().includes(q) || !!group.exercise.nameIt?.toLowerCase().includes(q);
      const matchesMuscle = !selectedMuscle || group.exercise.primaryMuscle === selectedMuscle;
      return matchesSearch && matchesMuscle;
    });
  }, [data, search, selectedMuscle]);

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon-sm" className="shrink-0" asChild>
          <Link href="/profile" aria-label="Indietro"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record personali</h1>
          <p className="text-muted-foreground text-sm">I più recenti in alto · tocca per i dettagli</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca esercizio (italiano o inglese)"
          className="pl-9 h-11 text-base"
        />
      </div>

      {/* Muscle filter chips */}
      {muscles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedMuscle(null)}
            className={cn(
              "shrink-0 h-9 inline-flex items-center text-[13px] px-3.5 rounded-full border transition-colors touch-manipulation",
              !selectedMuscle
                ? "bg-primary text-primary-foreground border-transparent"
                : "border-border text-muted-foreground hover:border-foreground"
            )}
          >
            Tutti
          </button>
          {muscles.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMuscle(selectedMuscle === m ? null : m)}
              className={cn(
                "shrink-0 h-9 inline-flex items-center text-[13px] px-3.5 rounded-full border transition-colors touch-manipulation",
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
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      )}

      {!isLoading && !data?.length && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Nessun record ancora</p>
            <p className="text-sm text-muted-foreground">
              Completa alcuni allenamenti per iniziare a registrare i tuoi PR.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && (data?.length ?? 0) > 0 && filtered.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nessun record trovato per questa ricerca.</p>
          </CardContent>
        </Card>
      )}

      <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        {filtered.map((group) => (
          <RecordRow key={group.exerciseId} group={group} />
        ))}
      </ul>
    </div>
  );
}
