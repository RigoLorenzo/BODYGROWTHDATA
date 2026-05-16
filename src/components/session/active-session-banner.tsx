"use client";

import { useSessionStore } from "@/store/session-store";
import { formatWorkoutDuration } from "@/lib/utils";
import { Dumbbell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ActiveSessionBanner() {
  const { activeSession } = useSessionStore();
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!activeSession) return;
    const update = () => {
      setElapsed(formatWorkoutDuration(new Date(activeSession.startedAt)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  return (
    <AnimatePresence>
      {activeSession && (
        <motion.div
          initial={{ y: -48 }}
          animate={{ y: 0 }}
          exit={{ y: -48 }}
          className="sticky top-0 z-50 bg-green-600 text-white"
        >
          <div className="container max-w-4xl mx-auto px-4 py-2 flex items-center gap-3">
            <Dumbbell className="h-4 w-4 shrink-0 animate-pulse-slow" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Allenamento in corso</p>
              <p className="text-xs opacity-80 tabular-nums">{elapsed}</p>
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
