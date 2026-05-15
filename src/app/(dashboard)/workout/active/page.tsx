"use client";

import { useSessionStore } from "@/store/session-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ActiveWorkoutView } from "@/components/session/active-workout-view";

export default function ActiveWorkoutPage() {
  const { activeSession } = useSessionStore();
  const router = useRouter();

  useEffect(() => {
    if (!activeSession) {
      router.replace("/dashboard");
    }
  }, [activeSession, router]);

  if (!activeSession) return null;

  return <ActiveWorkoutView session={activeSession} />;
}
