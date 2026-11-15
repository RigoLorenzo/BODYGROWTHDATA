"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useSessionStore } from "@/store/session-store";
import { IDLE_SECONDS, staleSession, type StaleSession } from "@/lib/session-duration";

const SNOOZE_KEY = "bodygrowth-stale-snooze";
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** "alle 19:27", "ieri alle 19:27", "venerdì alle 19:27" */
function when(date: Date): string {
  const time = format(date, "HH:mm");
  if (isToday(date)) return `alle ${time}`;
  if (isYesterday(date)) return `ieri alle ${time}`;
  return `${format(date, "EEEE", { locale: it })} alle ${time}`;
}

function snoozed(sessionId: string, now: number): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "null") as { id: string; at: number } | null;
    return value?.id === sessionId && now - value.at < IDLE_SECONDS * 1000;
  } catch {
    return false;
  }
}

/**
 * Allenamento in corso fermo da più di 90 minuti (app chiusa e dimenticata):
 * al rientro propone di chiuderlo poco dopo l'ultima serie, non adesso,
 * così la durata resta quella vera. Si può anche continuare o scartarlo.
 */
export function StaleSessionPrompt() {
  const router = useRouter();
  const session = useSessionStore((s) => s.activeSession);
  const endSession = useSessionStore((s) => s.endSession);
  const { completeWorkout } = useWorkoutSession();
  const [stale, setStale] = useState<StaleSession | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(() => {
    if (!session || document.visibilityState !== "visible") return;
    const now = new Date();
    if (snoozed(session.id, now.getTime())) return;
    setStale(staleSession(session, now));
  }, [session]);

  useEffect(() => {
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [check]);

  if (!session || !stale) return null;

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ id: session.id, at: Date.now() }));
    setStale(null);
  };

  const close = async () => {
    setBusy(true);
    try {
      await completeWorkout(
        stale.suggestedEnd ? { sessionId: session.id, endedAt: stale.suggestedEnd.toISOString() } : { sessionId: session.id, estimate: true }
      );
      const id = session.id;
      endSession();
      setStale(null);
      toast({
        title: "Allenamento chiuso",
        description: stale.suggestedEnd ? `Finito ${when(stale.suggestedEnd)}, dopo l'ultima serie.` : "Con la durata tipica delle tue sedute.",
      });
      router.push(`/workout/${id}`);
    } catch {
      // Il messaggio d'errore lo mostra già il salvataggio
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      endSession();
      setStale(null);
      toast({ title: "Allenamento scartato" });
      router.replace("/dashboard");
    } catch {
      toast({ title: "Non scartato", description: "Controlla la connessione e riprova.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const started = new Date(session.startedAt);
  const title = session.programDayName ?? "L'allenamento";

  return (
    <AlertDialog open onOpenChange={(open) => !open && snooze()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Allenamento ancora aperto</AlertDialogTitle>
          <AlertDialogDescription>
            {title} è iniziato {when(started)}.{" "}
            {stale.hasDoneSets
              ? stale.suggestedEnd
                ? `L'ultima serie è ${when(stale.lastActivity)}: forse hai dimenticato di chiuderlo.`
                : "Forse hai dimenticato di chiuderlo."
              : "Non hai ancora fatto nessuna serie."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {stale.hasDoneSets ? (
            <Button className="h-12 w-full" onClick={close} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {stale.suggestedEnd ? `Chiudi ${when(stale.suggestedEnd)}` : "Chiudi con la durata tipica"}
            </Button>
          ) : (
            <Button variant="destructive" className="h-12 w-full" onClick={discard} disabled={busy}>
              Scarta allenamento
            </Button>
          )}
          <Button variant="outline" className="h-12 w-full" onClick={snooze} disabled={busy}>
            Mi sto ancora allenando
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
