"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronLeft, Play, Square, Trash2, CalendarDays } from "lucide-react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProgramDay { id: string; name: string; dayIndex: number }
interface Program {
  id: string;
  name: string;
  description?: string | null;
  frequency: number;
  durationWeeks: number;
  splitType: string;
  days: ProgramDay[];
  activations: { id: string }[];
}

const SPLIT_LABELS: Record<string, string> = {
  PPL: "Push/Pull/Legs",
  UPPER_LOWER: "Upper/Lower",
  BRO_SPLIT: "Bro Split",
  FULL_BODY: "Full Body",
  ARNOLD: "Arnold Split",
  CUSTOM: "Personalizzato",
};

export default function ProgramsPage() {
  const queryClient = useQueryClient();

  const { data: programs, isLoading } = useQuery<Program[]>({
    queryKey: ["programs"],
    queryFn: async () => {
      const res = await fetch("/api/programs");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: active } = useQuery<{ programId: string } | null>({
    queryKey: ["programs", "active"],
    queryFn: async () => {
      const res = await fetch("/api/programs/active");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (programId: string) => {
      const res = await fetch("/api/programs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "active"] });
      toast({ title: "Piano attivato!" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/programs/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "active"] });
      toast({ title: "Piano disattivato" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["programs", "active"] });
      toast({ title: "Piano eliminato" });
    },
  });

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/profile"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Piani di Allenamento</h1>
          <p className="text-muted-foreground text-sm">Gestisci i tuoi programmi</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/programs/new"><Plus className="h-4 w-4 mr-1" />Nuovo</Link>
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      )}

      {!isLoading && !programs?.length && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">Nessun piano ancora</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crea un programma strutturato per seguire i tuoi allenamenti.
            </p>
            <Button asChild><Link href="/programs/new"><Plus className="h-4 w-4 mr-1" />Crea Piano</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {programs?.map((program) => {
          const isActive = active?.programId === program.id;
          return (
            <Card key={program.id} className={`border-border/50 ${isActive ? "border-primary/50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate">{program.name}</p>
                      {isActive && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Attivo</Badge>}
                    </div>
                    {program.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{program.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{program.frequency}×/settimana</span>
                      <span>·</span>
                      <span>{program.durationWeeks} settimane</span>
                      <span>·</span>
                      <span>{SPLIT_LABELS[program.splitType] ?? program.splitType}</span>
                    </div>
                    {program.days.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {program.days.map((d) => (
                          <span key={d.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                            {d.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  {isActive ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => deactivateMutation.mutate()}
                      disabled={deactivateMutation.isPending}
                    >
                      <Square className="h-3.5 w-3.5 mr-1" />
                      Disattiva
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => activateMutation.mutate(program.id)}
                      disabled={activateMutation.isPending}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Attiva
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminare il piano?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Questa azione non può essere annullata. Il piano verrà eliminato definitivamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(program.id)}
                        >
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
