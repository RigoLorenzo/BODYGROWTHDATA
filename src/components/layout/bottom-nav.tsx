"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Footprints, HeartPulse, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** Quattro sezioni: l'allenamento si avvia (o si riprende) dalla home */
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/run", icon: Footprints, label: "Corsa" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/wellness", icon: HeartPulse, label: "Benessere" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="border-t border-border/50 bg-background">
        {/* Colonne uguali: ogni voce è centrata nella sua, qualunque sia la lunghezza dell'etichetta */}
        <div className="grid grid-cols-4 items-center px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                  />
                )}
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
