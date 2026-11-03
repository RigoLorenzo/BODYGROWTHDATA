"use client";

import { RunHeader } from "@/components/run/run-header";
import { RunOverview } from "@/components/run/run-overview";
import { cn } from "@/lib/utils";
import { StrengthTab } from "./strength-tab";
import { SummaryTab } from "./summary-tab";
import { useUrlTab } from "./tab-strip";

/**
 * Fitness: tutte le attività nel Riepilogo, poi Palestra e Corsa nel
 * dettaglio. Il periodo scelto resta lo stesso passando da una scheda
 * all'altra (sta nell'URL); lo storico completo è in /history.
 */
const TABS = [
  { value: "riepilogo", label: "Riepilogo" },
  { value: "palestra", label: "Palestra" },
  { value: "corsa", label: "Corsa" },
] as const;

/** Vecchi nomi delle schede: i link salvati continuano a funzionare */
const ALIASES = {
  andamento: "riepilogo",
  progressi: "riepilogo",
  record: "riepilogo",
  volume: "palestra",
  muscoli: "palestra",
} as const;

function RunTab() {
  return (
    <div className="space-y-5">
      <RunHeader />
      <RunOverview />
    </div>
  );
}

export function FitnessTabs() {
  const [tab, select] = useUrlTab(TABS, ALIASES);
  return (
    <div className="space-y-3">
      {/* Tab di testo: navigano tra viste; il selettore a pillole sotto filtra il periodo */}
      <div role="tablist" aria-label="Viste di Fitness" className="flex gap-6 border-b border-border/60">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => select(t.value)}
            className={cn(
              "-mb-px h-11 border-b-2 text-base font-semibold transition-colors",
              tab === t.value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "palestra" ? <StrengthTab /> : tab === "corsa" ? <RunTab /> : <SummaryTab />}
    </div>
  );
}
