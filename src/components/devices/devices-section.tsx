"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GarminCard } from "@/components/run/garmin-card";
import { MiFitnessCard } from "@/components/run/mifitness-card";
import { useDevices } from "@/components/run/queries";
import { StravaCard } from "@/components/run/strava-card";
import { requestDeviceReconnect } from "./device-sync";
import { DEVICE_PROVIDERS, type DeviceProvider } from "./labels";
import { WellnessSourcePicker } from "./wellness-source-picker";

/** ?ricollega=GARMIN (da Corsa o Benessere): porta alla card e avvia il ricollegamento */
function useReconnectRequest(ready: boolean) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("ricollega");

  useEffect(() => {
    if (!ready || !requested) return;
    if ((DEVICE_PROVIDERS as readonly string[]).includes(requested)) requestDeviceReconnect(requested as DeviceProvider);
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requested]);
}

/**
 * Smartwatch e app collegate: le corse arrivano da tutti, sonno e battiti
 * dal dispositivo scelto come fonte del benessere.
 */
export function DevicesSection() {
  const { data, isSuccess } = useDevices();
  const connected = data?.devices.filter((d) => d.connection).map((d) => d.provider) ?? [];
  useReconnectRequest(isSuccess);

  return (
    <div className="space-y-3">
      <WellnessSourcePicker connected={connected} value={data?.wellnessSource ?? null} className="px-1" />
      <MiFitnessCard />
      <GarminCard />
      <StravaCard />
    </div>
  );
}
