"use client";

import { WellnessSourcePicker } from "@/components/devices/wellness-source-picker";
import { GarminCard } from "./garmin-card";
import { MiFitnessCard } from "./mifitness-card";
import { useDevices } from "./queries";

/**
 * Smartwatch collegabili: le corse arrivano da tutti quelli collegati, il
 * benessere da quello scelto. Ogni dispositivo ha la sua card.
 */
export function DevicesSection() {
  const { data } = useDevices();
  const connected = data?.devices.filter((d) => d.connection).map((d) => d.provider) ?? [];

  return (
    <section aria-labelledby="devices-title" className="space-y-3">
      <div className="px-1">
        <h2 id="devices-title" className="font-display text-xl font-bold uppercase tracking-wide">
          Dispositivi
        </h2>
        <p className="text-xs text-muted-foreground">
          Collega uno o più smartwatch: le corse arrivano da tutti, sonno e battiti dal dispositivo che scegli.
        </p>
      </div>
      <WellnessSourcePicker connected={connected} value={data?.wellnessSource ?? null} className="px-1" />
      <MiFitnessCard />
      <GarminCard />
    </section>
  );
}
