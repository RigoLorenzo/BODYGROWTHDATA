"use client";

import { usePathname } from "next/navigation";
import { useSessionStore, getOpenRest } from "@/store/session-store";
import { useSessionTimers } from "@/hooks/use-rest-timer";
import { formatClock } from "@/lib/utils";
import { Dumbbell, ChevronRight, Timer } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export function ActiveSessionBanner() {
  const activeSession = useSessionStore((s) => s.activeSession);
  const { totalSeconds, restSeconds, activeSeconds } = useSessionTimers();
  const pathname = usePathname();

  // Sulla schermata dell'allenamento i cronometri sono già nell'header
  const hidden = pathname?.startsWith("/workout/active");
  const resting = !!getOpenRest(activeSession);

  return (
    <AnimatePresence>
      {activeSession && !hidden && (
        <motion.div
          initial={{ y: -48 }}
          animate={{ y: 0 }}
          exit={{ y: -48 }}
          className="sticky top-0 z-50 bg-green-600 text-white"
        >
          <div className="container max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
            {resting ? (
              <Timer className="h-4 w-4 shrink-0 animate-pulse-slow" />
            ) : (
              <Dumbbell className="h-4 w-4 shrink-0 animate-pulse-slow" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">
                {resting ? "In recupero" : "Allenamento in corso"}
              </p>
              <p className="text-xs opacity-80 tabular-nums truncate">
                {formatClock(totalSeconds)} · effettivo {formatClock(activeSeconds)} · recupero{" "}
                {formatClock(restSeconds)}
              </p>
            </div>
            <Link
              href="/workout/active"
              className="flex items-center gap-1 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 transition-colors"
            >
              Continua <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
