"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Dumbbell, Trophy, type LucideIcon } from "lucide-react";
import { useActiveProgram } from "@/hooks/use-active-program";
import { useRecordGroups } from "./profile-hero";

interface Tile {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

/** Accessi rapidi del profilo: riquadri con il dato più utile di ciascuna sezione */
export function ProfileLinks() {
  const { data: records } = useRecordGroups();
  const { data: program } = useActiveProgram();

  const tiles: Tile[] = [
    {
      href: "/records",
      icon: Trophy,
      label: "Record",
      value: records ? String(records.length) : "—",
      hint: records?.length === 1 ? "esercizio con record" : "esercizi con record",
    },
    {
      href: "/programs",
      icon: CalendarDays,
      label: "Piano",
      value: program ? `Sett. ${program.weekProgress}` : "Nessuno",
      hint: program?.program.name ?? "Crea o attiva un programma",
    },
  ];

  return (
    <nav aria-label="Sezioni del profilo" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ href, icon: Icon, label, value, hint }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-[132px] flex-col justify-between rounded-3xl border border-border/60 bg-card p-4 transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/15 text-lime-700 dark:text-[#d4ff3a]">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-active:translate-x-0.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
              <span className="block truncate font-display text-2xl font-bold uppercase leading-tight">{value}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
      <Link
        href="/profile/exercises"
        className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card px-4 py-3.5 active:bg-muted/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Dumbbell className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Libreria esercizi</span>
          <span className="block truncate text-xs text-muted-foreground">Catalogo e i tuoi esercizi personalizzati</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </nav>
  );
}
