"use client";

import { usePathname } from "next/navigation";
import { useSessionStore } from "@/store/session-store";
import { Dumbbell, ChevronRight } from "lucide-react";
import Link from "next/link";

export function ActiveSessionBanner() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const pathname = usePathname();

  // Sulla schermata dell'allenamento e sulla home il riepilogo è già a schermo
  if (!activeSession || pathname?.startsWith("/workout/active") || pathname === "/dashboard") return null;

  const sets = activeSession.exercises.flatMap((ex) => ex.sets);
  const done = sets.filter((s) => s.completed).length;

  return (
    <div className="sticky top-safe z-50 bg-green-600 text-white">
      <div className="container max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
        <Dumbbell className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">
            {activeSession.programDayName ?? "Allenamento in corso"}
          </p>
          <p className="text-xs opacity-80 tabular-nums">
            {done}/{sets.length} serie fatte
          </p>
        </div>
        <Link
          href="/workout/active"
          className="flex items-center gap-1 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 transition-colors"
        >
          Continua <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
