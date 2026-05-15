"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { Dumbbell, Zap, RotateCcw } from "lucide-react";
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
    <div className="grid grid-cols-3 gap-3">
      <Button
        size="xl"
        className="col-span-2 flex items-center gap-3 h-16"
        onClick={() => startWorkout({ workoutType: "CUSTOM" })}
        disabled={isLoading}
      >
        <Dumbbell className="h-6 w-6" />
        <span>{isLoading ? "Avvio..." : "Inizia Allenamento"}</span>
      </Button>
      <div className="flex flex-col gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 flex items-center gap-1 text-xs"
          onClick={() => startWorkout({ workoutType: "CUSTOM" })}
          disabled={isLoading}
        >
          <Zap className="h-3.5 w-3.5" />
          Libero
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 flex items-center gap-1 text-xs"
          disabled={isLoading}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ultimo
        </Button>
      </div>
    </div>
  );
}
