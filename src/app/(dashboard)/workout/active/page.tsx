"use client";

import { useSessionStore } from "@/store/session-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ActiveWorkoutView } from "@/components/session/active-workout-view";
import { WorkoutSummaryCard } from "@/components/session/workout-summary-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Prisma } from "@prisma/client";

type CompletedWorkout = Prisma.WorkoutSessionGetPayload<{
  include: {
    personalRecords: { include: { exercise: true } };
    exercises: { include: { exercise: true; sets: true } };
  };
}>;

export default function ActiveWorkoutPage() {
  const { activeSession, endSession } = useSessionStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // Il riepilogo vive qui: la sessione locale viene chiusa al salvataggio,
  // ma il resoconto (durata, volume, serie) deve restare a schermo.
  const [completedWorkout, setCompletedWorkout] = useState<CompletedWorkout | null>(null);
  // Il nome del giorno del piano va letto prima che la sessione locale si chiuda
  const [completedDayName, setCompletedDayName] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !activeSession?.id && !completedWorkout) {
      router.replace("/dashboard");
    }
  }, [mounted, activeSession, completedWorkout, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen p-4 space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (completedWorkout) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm"
        >
          <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
            <WorkoutSummaryCard
              workout={completedWorkout}
              dayName={completedDayName}
              celebrate
              onClose={() => router.replace("/dashboard")}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!activeSession?.id) return null;

  return (
    <ActiveWorkoutView
      session={activeSession}
      onCompleted={(workout) => {
        setCompletedDayName(activeSession.programDayName ?? null);
        setCompletedWorkout(workout);
        endSession();
      }}
    />
  );
}
