"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { NOTE_MAX, NOTE_TAGS, cleanNote, noteHasTag, toggleNoteTag } from "@/lib/exercise-notes";
import { cn } from "@/lib/utils";
import type { ActiveExercise } from "@/types";

/** Salva la nota sul giorno del piano; false se l'esercizio non è nel giorno */
async function saveToPlan(dayId: string, exerciseId: string, notes: string | null): Promise<boolean> {
  const res = await fetch(`/api/programs/days/${dayId}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exerciseId, notes }),
  });
  if (!res.ok) throw new Error("Nota non salvata");
  const body: { saved: boolean } = await res.json();
  return body.saved;
}

/**
 * Nota dell'esercizio, modificabile durante l'allenamento: nel piano resta
 * per le prossime sedute dello stesso giorno, altrimenti si riprende
 * dall'ultima volta che fai l'esercizio. Etichette rapide per superset & co.
 */
export function ExerciseNote({ exercise }: { exercise: ActiveExercise }) {
  const setExerciseNotes = useSessionStore((s) => s.setExerciseNotes);
  const programDayId = useSessionStore((s) => s.activeSession?.programDayId);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const note = exercise.notes?.trim() ?? "";
  const editing = draft != null;

  const save = async () => {
    const notes = cleanNote(draft);
    setExerciseNotes(exercise.id, notes ?? "");
    setDraft(null);
    if (!programDayId) return;
    try {
      const saved = await saveToPlan(programDayId, exercise.exerciseId, notes);
      if (saved) queryClient.invalidateQueries({ queryKey: ["programs"] });
    } catch {
      toast({ title: "Nota salvata solo per oggi", description: "Il piano non è raggiungibile: riprova più tardi." });
    }
  };

  if (!editing) {
    return note ? (
      <button
        type="button"
        onClick={() => setDraft(note)}
        className="flex w-full items-start gap-1.5 rounded-lg px-1 py-1 text-left text-xs text-primary/80 active:bg-muted/50"
        aria-label="Modifica nota"
      >
        <span className="min-w-0 flex-1 whitespace-pre-line">{note}</span>
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setDraft("")}
        className="flex h-8 items-center gap-1 rounded-lg px-1 text-xs text-muted-foreground active:bg-muted/50"
      >
        <Plus className="h-3.5 w-3.5" /> Aggiungi nota
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl bg-muted/40 p-2">
      <div className="flex flex-wrap gap-1.5">
        {NOTE_TAGS.map((tag) => {
          const active = noteHasTag(draft, tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => setDraft(toggleNoteTag(draft, tag))}
              className={cn(
                "h-8 rounded-full px-3 text-xs font-medium",
                active ? "bg-foreground text-background" : "bg-background text-muted-foreground"
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
        rows={2}
        autoFocus
        placeholder="Es. superset con curl EZ, sbarra Batman, presa stretta…"
        aria-label={`Nota per ${exercise.exerciseName}`}
        className="w-full resize-none rounded-lg border border-border/60 bg-background px-2 py-1.5 text-base leading-snug sm:text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {programDayId ? "Resta per le prossime sedute di questo giorno" : "Resta per la prossima volta"}
        </p>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDraft(null)}>
            Annulla
          </Button>
          <Button size="sm" className="text-xs" onClick={save}>
            Salva
          </Button>
        </div>
      </div>
    </div>
  );
}
