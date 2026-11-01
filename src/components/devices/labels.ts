import type { WellnessSource } from "@/lib/wellness/types";

/** Smartwatch collegabili, lato interfaccia */
export type DeviceProvider = WellnessSource;

export const DEVICE_PROVIDERS: readonly DeviceProvider[] = ["MI_FITNESS", "GARMIN"];

export const DEVICE_LABEL: Record<DeviceProvider, string> = { MI_FITNESS: "Mi Fitness", GARMIN: "Garmin" };

/** App del telefono che carica i dati dell'orologio sul cloud */
export const DEVICE_APP: Record<DeviceProvider, string> = { MI_FITNESS: "Mi Fitness", GARMIN: "Garmin Connect" };

/** Dove attivare le misure continue di stress e ossigeno */
export const MONITORING_TIP: Record<DeviceProvider, string> = {
  MI_FITNESS:
    "Nell'app Mi Fitness, alla pagina del dispositivo, attiva il monitoraggio continuo dello stress e la SpO₂ durante il sonno",
  GARMIN:
    "In Garmin Connect, nelle impostazioni del dispositivo, attiva il rilevamento dello stress e il pulsossimetro durante il sonno",
};

/** Ancora della card di collegamento nella pagina Corsa */
export const DEVICE_ANCHOR: Record<DeviceProvider, string> = { MI_FITNESS: "mifitness", GARMIN: "garmin" };
