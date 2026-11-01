"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/analytics/ui";
import { TabStrip, useUrlTab } from "@/components/analytics/tab-strip";
import { WellnessSourcePicker } from "@/components/devices/wellness-source-picker";
import type { WellnessResponse } from "@/lib/wellness/types";
import { ActivityTab } from "./activity-tab";
import { HeartTab } from "./heart-tab";
import { OverviewTab } from "./overview-tab";
import { useWellness } from "./queries";
import { SleepTab } from "./sleep-tab";
import { HistoryProgress, SyncStatus, WellnessEmpty } from "./sync-status";
import { useWellnessBackfill } from "./use-wellness-backfill";
import { VitalsTab } from "./vitals-tab";

const TABS = [
  { value: "panoramica", label: "Panoramica" },
  { value: "battiti", label: "Battiti" },
  { value: "sonno", label: "Sonno" },
  { value: "attivita", label: "Passi" },
  { value: "vitali", label: "Stress e SpO₂" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function TabContent({ tab, data }: { tab: Tab; data: WellnessResponse }) {
  switch (tab) {
    case "battiti":
      return <HeartTab data={data} />;
    case "sonno":
      return <SleepTab data={data} />;
    case "attivita":
      return <ActivityTab data={data} />;
    case "vitali":
      return <VitalsTab data={data} />;
    default:
      return <OverviewTab data={data} />;
  }
}

/** Sezione Benessere: dati dello smartwatch, scheda scelta nell'URL (?tab=) */
export function WellnessTabs() {
  const [tab, select] = useUrlTab(TABS);
  const { data, isLoading, isError } = useWellness();
  const backfill = useWellnessBackfill(data);

  return (
    <div className="space-y-5">
      <TabStrip tabs={TABS} value={tab} onChange={select} label="Sezioni di Benessere" />
      {isLoading ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : isError || !data ? (
        <EmptyState>Dati non disponibili: riprova tra poco.</EmptyState>
      ) : (
        <>
          <WellnessSourcePicker connected={data.sources} value={data.source} />
          <HistoryProgress data={data} progress={backfill.progress} active={backfill.active} />
          {!data.days.length && !data.sleeps.length ? (
            <WellnessEmpty connected={data.connected} source={data.source} />
          ) : (
            <TabContent tab={tab} data={data} />
          )}
          {data.connected && <SyncStatus data={data} />}
        </>
      )}
    </div>
  );
}
