"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore, getRestAfterSet, getRestAfterExercise, getTotalRestSeconds } from "@/store/session-store";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import type { ActiveExercise } from "@/types";

type PlanExerciseInput = {
  exerciseId: string;
  exerciseName: string;
  exerciseNameIt?: string | null;
  restSeconds?: number;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
};

type StartWorkoutInput = {
  workoutType?: string;
  templateId?: string;
  programDayId?: string;
  programDayName?: string;
  planDayIndex?: number;
};

export function useWorkoutSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeSession, startSession } = useSessionStore();
  const planExercisesRef = useRef<PlanExerciseInput[]>([]);

  const startMutation = useMutation({
    mutationFn: async (data: StartWorkoutInput) => {
      // programDayName / planDayIndex servono solo lato client
      const payload = {
        workoutType: data.workoutType,
        templateId: data.templateId,
        programDayId: data.programDayId,
      };
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to start session");
      return res.json();
    },
    onSuccess: (session, variables) => {
      const exercises: ActiveExercise[] = planExercisesRef.current.map((ex, idx) => ({
        id: `plan-${ex.exerciseId}-${Date.now()}-${idx}`,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        exerciseNameIt: ex.exerciseNameIt ?? null,
        orderIndex: idx,
        restTimerSeconds: ex.restSeconds ?? 90,
        fromPlan: true,
        targetSets: ex.sets,
        targetRepsMin: ex.repsMin,
        targetRepsMax: ex.repsMax,
        // Serie pre-caricate come da piano, pronte da compilare
        sets: Array.from({ length: Math.max(1, ex.sets ?? 1) }, (_, i) => ({
          setNumber: i + 1,
          type: "WORKING" as const,
          completed: false,
        })),
      }));
      startSession({
        id: session.id,
        startedAt: new Date(session.startedAt),
        exercises,
        restIntervals: [],
        programDayId: variables.programDayId,
        programDayName: variables.programDayName,
      });
      planExercisesRef.current = [];
      router.push(`/workout/active`);
      toast({ title: "Allenamento iniziato!", description: "Dai tutto!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile avviare l'allenamento", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // Chiude il recupero eventualmente ancora in corso, così finisce nei totali
      useSessionStore.getState().endRest();
      const { activeSession } = useSessionStore.getState();

      const exercises = (activeSession?.exercises ?? [])
        .map((ex, idx) => ({
          exerciseId: ex.exerciseId,
          orderIndex: ex.orderIndex ?? idx,
          restTimerSeconds: ex.restTimerSeconds,
          restAfterSeconds: getRestAfterExercise(activeSession, ex.id),
          sets: ex.sets
            .map((s, setIndex) => ({ set: s, restSeconds: getRestAfterSet(activeSession, ex.id, setIndex) }))
            .filter(({ set: s }) => s.completed)
            .map(({ set: s, restSeconds }) => ({
              setNumber: s.setNumber,
              type: s.type,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              restSeconds,
            })),
        }))
        .filter((ex) => ex.sets.length > 0);

      const totalRestSeconds = getTotalRestSeconds(activeSession);

      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises, totalRestSeconds }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
      return res.json();
    },
    onSuccess: () => {
      // La sessione locale viene chiusa da chi mostra il riepilogo,
      // così il resoconto finale resta a schermo.
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["records"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare l'allenamento", variant: "destructive" });
    },
  });

  const startWorkout = (
    data?: StartWorkoutInput,
    planExercises?: PlanExerciseInput[]
  ) => {
    const { activeSession: current } = useSessionStore.getState();
    if (current) {
      toast({
        title: "Allenamento in corso",
        description: "Termina o abbandona l'allenamento attuale prima di iniziarne uno nuovo.",
        variant: "destructive",
      });
      return;
    }
    planExercisesRef.current = planExercises ?? [];
    startMutation.mutate(data ?? {});
  };

  return {
    activeSession,
    isLoading: startMutation.isPending,
    startWorkout,
    completeWorkout: completeMutation.mutateAsync,
    isCompleting: completeMutation.isPending,
  };
}

export function useRecentWorkouts() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await fetch("/api/sessions?limit=10");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });
}

export function useExerciseSearch(query: string, muscle?: string) {
  return useQuery({
    queryKey: ["exercises", query, muscle],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (muscle) params.set("muscle", muscle);
      const res = await fetch(`/api/exercises?${params}`);
      if (!res.ok) throw new Error("Failed to search exercises");
      return res.json();
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?type=overview");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteWorkout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      router.push("/dashboard");
      toast({ title: "Allenamento eliminato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare l'allenamento", variant: "destructive" });
    },
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      nameIt?: string;
      primaryMuscle: string;
      muscleGroups: string[];
      category: string;
      equipment: string[];
    }) => {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create exercise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast({ title: "Esercizio creato!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare l'esercizio", variant: "destructive" });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name: string;
      nameIt?: string;
      primaryMuscle: string;
      muscleGroups: string[];
      category: string;
      equipment: string[];
    }) => {
      const res = await fetch(`/api/exercises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update exercise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast({ title: "Esercizio aggiornato!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare l'esercizio", variant: "destructive" });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/exercises/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete exercise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast({ title: "Esercizio eliminato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare l'esercizio", variant: "destructive" });
    },
  });
}

interface LastSessionData {
  date: string;
  maxWeight: number;
  maxReps: number;
  volume: number;
  oneRM: number;
}

export function useLastExerciseSession(exerciseId: string) {
  return useQuery<LastSessionData | null>({
    queryKey: ["exercise-last", exerciseId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/exercise/${exerciseId}?last=true`);
      if (!res.ok) return null;
      const data = await res.json();
      return data[0] ?? null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!exerciseId,
  });
}

export function useHeatmapData(year: number, initialData?: Record<string, { volume: number }>) {
  return useQuery({
    queryKey: ["analytics", "heatmap", year],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?type=heatmap&year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch heatmap");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    initialData,
  });
}
