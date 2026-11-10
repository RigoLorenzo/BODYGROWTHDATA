"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardList, HeartPulse, LayoutDashboard, Sparkles } from "lucide-react";
import { FITNESS_PATH, PLAN_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Quattro sezioni: Home (si avvia l'allenamento), Fitness (palestra, corsa e
 * riepilogo), Piano (il programma completo) e Benessere. `also`: pagine
 * interne che appartengono alla sezione. Il Coach compare al centro solo
 * per chi può usarlo.
 */
interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  also?: string[];
}

const baseItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: FITNESS_PATH, icon: BarChart3, label: "Fitness", also: ["/history", "/records", "/run"] },
  { href: PLAN_PATH, icon: ClipboardList, label: "Piano", also: ["/programs"] },
  { href: "/wellness", icon: HeartPulse, label: "Benessere" },
];

const coachItem: NavItem = { href: "/coach", icon: Sparkles, label: "Coach" };

function useCoachAccess() {
  const { data } = useQuery<{ access: boolean }>({
    queryKey: ["coach", "access"],
    queryFn: async () => {
      const res = await fetch("/api/coach/access");
      return res.ok ? res.json() : { access: false };
    },
    staleTime: 10 * 60_000,
  });
  return Boolean(data?.access);
}

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/**
 * Navigazione principale: barra in basso sul telefono, colonna a sinistra
 * da tablet in su (il layout le riserva md:pl-64).
 */
export function BottomNav() {
  const pathname = usePathname();
  const coach = useCoachAccess();
  const navItems = coach ? [...baseItems.slice(0, 2), coachItem, ...baseItems.slice(2)] : baseItems;

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed bottom-0 left-0 right-0 z-40 md:inset-y-0 md:right-auto md:w-64 md:border-r md:border-border/60 md:bg-background"
    >
      <div className="border-t border-border/50 bg-background md:border-0 md:px-4 md:pt-8">
        <p className="hidden px-3 pb-6 font-display text-2xl font-extrabold uppercase tracking-tight md:block">BodyGrowth</p>
        {/* Colonne uguali: ogni voce è centrata nella sua, qualunque sia la lunghezza dell'etichetta */}
        <div
          className={cn(
            "grid items-center px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:flex md:flex-col md:items-stretch md:gap-1 md:p-0",
            coach ? "grid-cols-5" : "grid-cols-4"
          )}
        >
          {navItems.map((item) => {
            const isActive = matches(pathname, item.href) || !!item.also?.some((h) => matches(pathname, h));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors",
                  "md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:py-2.5",
                  isActive ? "text-primary md:bg-muted" : "text-muted-foreground md:hover:bg-muted/60"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary md:hidden"
                  />
                )}
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate text-[10px] font-medium md:text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
