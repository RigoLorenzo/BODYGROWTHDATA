"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  exercise: { name: string; primaryMuscle: string | null };
  records: PR[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; format: (v: number, r?: number | null, w?: number | null) => string }> = {
  WEIGHT:  { label: "Peso Max",    color: "text-blue-400",   format: (v) => `${v}kg` },
  REPS:    { label: "Reps Max",    color: "text-green-400",  format: (v) => `${v} reps` },
  VOLUME:  { label: "Volume Max",  color: "text-purple-400", format: (v) => formatVolume(v) },
  ONE_RM:  { label: "1RM Stimato", color: "text-orange-400", format: (v) => `${v}kg` },
};

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
      const matchesSearch = !search || group.exercise.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = !selectedMuscle || group.exercise.primaryMuscle === selectedMuscle;
      return matchesSearch && matchesMuscle;
    });
  }, [data, search, selectedMuscle]);

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/profile"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Personal Records</h1>
          <p className="text-muted-foreground text-sm">I tuoi migliori risultati</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca esercizio..."
          className="pl-9"
        />
      </div>

      {/* Muscle filter chips */}
      {muscles.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedMuscle(null)}
            className={cn(
              "shrink-0 text-xs px-3 py-1 rounded-full border transition-colors",
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

      {!isLoading && data?.length > 0 && filtered.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nessun record trovato per questa ricerca.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((group) => (
          <Card key={group.exerciseId} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-sm">{group.exercise.name}</p>
                {group.exercise.primaryMuscle && (
                  <Badge
                    className="border text-[10px]"
                    style={{
                      background: `${getMuscleColor(group.exercise.primaryMuscle)}20`,
                      color: getMuscleColor(group.exercise.primaryMuscle),
                      borderColor: `${getMuscleColor(group.exercise.primaryMuscle)}40`,
                    }}
                  >
                    {getMuscleLabel(group.exercise.primaryMuscle)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {group.records.map((pr) => {
                  const cfg = TYPE_CONFIG[pr.recordType];
                  if (!cfg) return null;
                  return (
                    <div key={pr.id} className="bg-muted/30 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{cfg.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${cfg.color}`}>
                        {cfg.format(pr.value, pr.reps, pr.weight)}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(pr.dateAchieved), "d MMM yyyy", { locale: it })}
                        </p>
                        {pr.improvementPercent != null && pr.improvementPercent > 0 && (
                          <div className="flex items-center gap-0.5 text-[10px] text-green-400">
                            <TrendingUp className="h-2.5 w-2.5" />
                            +{pr.improvementPercent.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
