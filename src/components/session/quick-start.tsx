"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkoutSession, useServerActiveSession } from "@/hooks/use-workout-session";
import { Dumbbell, Play, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useSessionStore } from "@/store/session-store";
import { StartWorkoutSheet } from "./start-workout-sheet";
import type { ActiveProgramResponse } from "@/types";

export function QuickStart() {
  const { startWorkout, isLoading, activeSession } = useWorkoutSession();
  const { setSessionPanelOpen } = useSessionStore();
  const { orphanSession, resume, discard } = useServerActiveSession();
  const [showPicker, setShowPicker] = useState(false);

  const { data: active, isPending: loadingPlan } = useQuery<ActiveProgramResponse | null>({
    queryKey: ["programs", "active"],
    queryFn: async () => {
      const res = await fetch("/api/programs/active");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  // Finché il piano non è caricato apriamo comunque la scelta del giorno:
  // così il tasto non fa mai partire un allenamento libero per sbaglio.
  const openPicker = loadingPlan || (active?.days?.length ?? 0) > 0;

  if (activeSession) {
    return (
      <Card className="border-green-600/30 bg-green-600/10">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-green-400">Allenamento in corso</p>
            <p className="text-xs text-muted-foreground">Hai un allenamento attivo</p>
          </div>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setSessionPanelOpen(true)}
          >
            Continua
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Allenamento aperto sul server ma non su questo dispositivo
  if (orphanSession) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="font-semibold text-amber-400">Allenamento aperto</p>
            <p className="text-xs text-muted-foreground">
              Iniziato alle {format(new Date(orphanSession.startedAt), "HH:mm 'del' d MMMM", { locale: it })}
              , probabilmente su un altro dispositivo. Riprendilo qui o scartalo per iniziarne uno nuovo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => resume.mutate(orphanSession.id)}
              disabled={resume.isPending || discard.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {resume.isPending ? "Ripresa..." : "Riprendi"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => discard.mutate(orphanSession.id)}
              disabled={resume.isPending || discard.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Scarta
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Button
        size="xl"
        className="w-full flex items-center gap-3 h-14"
        onClick={() => (openPicker ? setShowPicker(true) : startWorkout({ workoutType: "CUSTOM" }))}
        disabled={isLoading}
      >
        <Dumbbell className="h-5 w-5" />
        <span>{isLoading ? "Avvio..." : "Inizia Allenamento"}</span>
      </Button>

      <AnimatePresence>
        {showPicker && <StartWorkoutSheet onClose={() => setShowPicker(false)} />}
      </AnimatePresence>
    </>
  );
}
