"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { Dumbbell } from "lucide-react";
import { useSessionStore } from "@/store/session-store";

export function QuickStart() {
  const { startWorkout, isLoading, activeSession } = useWorkoutSession();
  const { setSessionPanelOpen } = useSessionStore();

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
    <Button
      size="xl"
      className="w-full flex items-center gap-3 h-14"
      onClick={() => startWorkout({ workoutType: "CUSTOM" })}
      disabled={isLoading}
    >
      <Dumbbell className="h-5 w-5" />
      <span>{isLoading ? "Avvio..." : "Inizia Allenamento"}</span>
    </Button>
  );
}
