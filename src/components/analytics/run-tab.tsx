"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRunStats } from "@/components/run/queries";
import { RunStatsSections } from "@/components/run/run-overview";
import { EmptyState } from "./ui";

/** Le statistiche della corsa dentro Analytics; elenco e collegamenti restano in /run */
export function RunTab() {
  const { data: stats, isLoading } = useRunStats();
  if (isLoading || !stats) return <Skeleton className="h-96 rounded-3xl" />;
  if (!stats.allTime.runs) {
    return (
      <EmptyState>
        Nessuna corsa ancora.{" "}
        <Link href="/run" className="font-medium text-foreground underline underline-offset-2">
          Collega Mi Fitness o aggiungi una corsa
        </Link>
        .
      </EmptyState>
    );
  }
  return (
    <div className="space-y-5">
      <RunStatsSections stats={stats} />
      <Link
        href="/run"
        className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-border/60 text-sm font-medium active:bg-muted/50"
      >
        Tutte le corse <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
