"use client";

import { useSessionStore } from "@/store/session-store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActiveWorkoutView } from "@/components/session/active-workout-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActiveWorkoutPage() {
  const { activeSession } = useSessionStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !activeSession?.id) {
      router.replace("/dashboard");
    }
  }, [mounted, activeSession, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen p-4 space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!activeSession?.id) return null;

  return <ActiveWorkoutView session={activeSession} />;
}
