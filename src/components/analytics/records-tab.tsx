"use client";

import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HighlightGrid, recordHighlights } from "./highlights";
import { EmptyState } from "./ui";
import { useActivity } from "./use-activity";

/** I tuoi record in una scheda a parte: settimane, mese e sedute migliori */
export function RecordsTab() {
  const { data: items, isLoading } = useActivity();
  if (isLoading || !items) return <Skeleton className="h-96 rounded-3xl" />;

  const list = recordHighlights(items);
  return (
    <div className="space-y-5">
      {list.length ? (
        <HighlightGrid list={list} />
      ) : (
        <EmptyState>Ancora nessun record: completa qualche allenamento per vederli qui.</EmptyState>
      )}
      <Link
        href="/records"
        className="flex items-center gap-3 rounded-3xl border border-border/60 bg-card p-4 active:bg-muted/50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Trophy className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Record per esercizio</span>
          <span className="block truncate text-xs text-muted-foreground">Carichi massimi e migliori serie di ogni esercizio</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
