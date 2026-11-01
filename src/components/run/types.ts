import type { DeviceProvider } from "@/components/devices/labels";
import type { BestEffort, RunSplit } from "@/lib/run/track";

/** Forme dei dati restituiti dalle API della sezione Corsa (date serializzate) */

export interface PeriodTotals {
  runs: number;
  distance: number;
  movingTime: number;
  elevationGain: number;
  avgPace: number | null;
}

export interface FitnessPoint {
  date: string;
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
}

export type FormTone = "fresh" | "neutral" | "tired" | "overreach";

export interface RunStats {
  week: PeriodTotals;
  month: PeriodTotals;
  year: PeriodTotals;
  allTime: PeriodTotals;
  weekly: (PeriodTotals & { weekStart: string })[];
  runsPerWeek: number;
  records: { name: string; distance: number; seconds: number; runId: string; date: string }[];
  longest: { id: string; distance: number; startedAt: string } | null;
  fastest: { id: string; distance: number; movingTime: number; startedAt: string } | null;
  fitness: {
    series: FitnessPoint[];
    today: FitnessPoint | null;
    label: { label: string; tone: FormTone } | null;
  };
  settings: {
    maxHeartRate: number | null;
    restingHeartRate: number | null;
    weeklyRunKmGoal: number | null;
    defaults: { maxHeartRate: number; restingHeartRate: number };
  };
  strava: { athleteName: string | null; lastSyncAt: string | null } | null;
}

export type ActivitySource = "STRAVA" | "MI_FITNESS" | "GARMIN" | "GPX" | "MANUAL";

export const SOURCE_LABEL: Record<ActivitySource, string> = {
  STRAVA: "Strava",
  MI_FITNESS: "Mi Fitness",
  GARMIN: "Garmin",
  GPX: "File GPX",
  MANUAL: "Inserita a mano",
};

/** Fonti che portano percorso e parziali in un secondo momento */
export const SYNCED_SOURCES: readonly ActivitySource[] = ["STRAVA", "MI_FITNESS", "GARMIN"];

export interface DeviceConnectionJson {
  account: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface GarminStatus {
  connection: DeviceConnectionJson | null;
}

export interface DevicesStatus {
  devices: { provider: DeviceProvider; label: string; connection: DeviceConnectionJson | null }[];
  /** orologio da cui arriva il benessere (null: nessuno collegato) */
  wellnessSource: DeviceProvider | null;
}

export interface MiFitnessStatus {
  connection: {
    xiaomiId: string;
    region: string;
    lastSyncAt: string | null;
    lastError: string | null;
    createdAt: string;
  } | null;
}

export interface RunListItem {
  id: string;
  name: string;
  source: ActivitySource;
  sportType: string;
  startedAt: string;
  distance: number;
  movingTime: number;
  elevationGain: number | null;
  avgHeartRate: number | null;
  polyline: string | null;
  trainingLoad: number | null;
}

export interface RunDetail extends RunListItem {
  externalId: string | null;
  elapsedTime: number;
  maxHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  splits: RunSplit[] | null;
  bestEfforts: BestEffort[] | null;
  detailed: boolean;
  notes: string | null;
}

export interface StravaStatus {
  configured: boolean;
  connection: { athleteId: string; athleteName: string | null; lastSyncAt: string | null; createdAt: string } | null;
}
