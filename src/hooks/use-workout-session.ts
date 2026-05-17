"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/store/session-store";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

export function useWorkoutSession() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeSession, startSession, endSession } = useSessionStore();

  const startMutation = useMutation({
    mutationFn: async (data: { workoutType?: string; templateId?: string }) => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to start session");
      return res.json();
    },
    onSuccess: (session) => {
      startSession({
        id: session.id,
        startedAt: new Date(session.startedAt),
        exercises: [],
      });
      router.push(`/workout/active`);
      toast({ title: "Allenamento iniziato!", description: "Dai tutto!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile avviare l'allenamento", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
      return res.json();
    },
    onSuccess: (session) => {
      endSession();
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      router.push(`/workout/${session.id}`);
      toast({ title: "Allenamento completato! 💪", description: `Ottimo lavoro!` });
    },
  });

  return {
    activeSession,
    isLoading: startMutation.isPending,
    startWorkout: startMutation.mutate,
    completeWorkout: completeMutation.mutate,
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
