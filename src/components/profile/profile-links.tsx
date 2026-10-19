import Link from "next/link";
import { CalendarDays, ChevronRight, Trophy, type LucideIcon } from "lucide-react";

const LINKS: { href: string; icon: LucideIcon; label: string; hint: string }[] = [
  { href: "/records", icon: Trophy, label: "Record personali", hint: "I tuoi migliori risultati per esercizio" },
  { href: "/programs", icon: CalendarDays, label: "Piani di allenamento", hint: "Crea, modifica e attiva un programma" },
];

/** Accessi rapidi del profilo, in un'unica scheda a righe */
export function ProfileLinks() {
  return (
    <nav aria-label="Sezioni del profilo" className="overflow-hidden rounded-3xl border border-border/60 bg-card">
      {LINKS.map(({ href, icon: Icon, label, hint }, i) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-3 px-5 py-4 active:bg-muted/50 ${i ? "border-t border-border/60" : ""}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block truncate text-xs text-muted-foreground">{hint}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </nav>
  );
}
