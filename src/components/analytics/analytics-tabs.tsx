"use client";

import { Segmented } from "./ui";
import { StrengthTab } from "./strength-tab";
import { SummaryTab } from "./summary-tab";
import { useUrlTab } from "./tab-strip";

/**
 * Due viste, nessun doppione: il Riepilogo per periodo (tutte le attività) e
 * il dettaglio della Palestra (carico e muscoli). Le statistiche della corsa
 * vivono nella sezione Corsa, lo storico completo in /history.
 */
const TABS = [
  { value: "riepilogo", label: "Riepilogo" },
  { value: "palestra", label: "Palestra" },
] as const;

/** Vecchi nomi delle schede: i link salvati continuano a funzionare */
const ALIASES = {
  andamento: "riepilogo",
  progressi: "riepilogo",
  record: "riepilogo",
  volume: "palestra",
  muscoli: "palestra",
} as const;

export function AnalyticsTabs() {
  const [tab, select] = useUrlTab(TABS, ALIASES);
  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Segmented value={tab} options={TABS} onChange={select} />
      </div>
      {tab === "palestra" ? <StrengthTab /> : <SummaryTab />}
    </div>
  );
}
