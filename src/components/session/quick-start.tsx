"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { Dumbbell } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { StartWorkoutSheet } from "./start-workout-sheet";
import type { ActiveProgramResponse } from "@/types";

export function QuickStart() {
  const { startWorkout, isLoading, activeSession } = useWorkoutSession();
  const { setSessionPanelOpen } = useSessionStore();
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
