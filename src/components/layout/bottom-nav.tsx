"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { StartWorkoutSheet } from "@/components/session/start-workout-sheet";
import { LayoutDashboard, Footprints, Plus, BarChart3, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/run", icon: Footprints, label: "Corsa" },
  { href: "/workout/active", icon: Plus, label: "Allena", cta: true },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/wellness", icon: HeartPulse, label: "Benessere" },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeSession } = useWorkoutSession();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="bg-background border-t border-border/50">
        <div className="flex items-center justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            if (item.cta) {
              return (
                <button
                  key={item.href}
                  aria-label={activeSession ? "Torna all'allenamento" : "Inizia allenamento"}
                  onClick={() =>
                    activeSession ? router.push("/workout/active") : setShowPicker(true)
                  }
                  className="relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  {activeSession && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse-slow" />
                  )}
                  <item.icon className="h-6 w-6 text-primary-foreground" />
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-[44px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute h-0.5 w-8 bg-primary rounded-full -top-0.5"
                  />
                )}
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showPicker && <StartWorkoutSheet onClose={() => setShowPicker(false)} />}
      </AnimatePresence>
    </nav>
  );
}
