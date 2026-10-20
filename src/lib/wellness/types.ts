/** Dati benessere condivisi tra sincronizzazione, API e interfaccia */

export type SleepStage = "deep" | "light" | "rem" | "awake";

export interface SleepSegment {
  stage: SleepStage;
  /** secondi epoch */
  start: number;
  end: number;
}

export interface HourlyHr {
  /** ora locale 0-23 */
  h: number;
  avg: number;
  min: number;
  max: number;
}

/** Riepilogo giornaliero; i campi assenti non sono stati misurati */
export interface DaySummary {
  date: string;
  steps?: number;
  distance?: number;
  activeCalories?: number;
  restingHr?: number;
  avgHr?: number;
  minHr?: number;
  maxHr?: number;
  hrHourly?: HourlyHr[];
  spo2Avg?: number;
  spo2Min?: number;
  stressAvg?: number;
  stressMax?: number;
}

export interface SleepInput {
  externalId: string;
  /** giorno locale del risveglio */
  date: string;
  startAt: Date;
  endAt: Date;
  /** minuti */
  duration: number;
  asleep: number;
  deep: number | null;
  light: number | null;
  rem: number | null;
  awake: number | null;
  score: number | null;
  isNap: boolean;
  avgHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  respRate: number | null;
  awakeCount: number | null;
  stages: SleepSegment[];
}

/** Come arrivano al browser da GET /api/wellness */
export interface WellnessDayJson {
  date: string;
  steps: number | null;
  distance: number | null;
  activeCalories: number | null;
  restingHr: number | null;
  avgHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  spo2Avg: number | null;
  spo2Min: number | null;
  stressAvg: number | null;
  stressMax: number | null;
}

export interface SleepJson {
  id: string;
  date: string;
  startAt: string;
  endAt: string;
  duration: number;
  asleep: number;
  deep: number | null;
  light: number | null;
  rem: number | null;
  awake: number | null;
  score: number | null;
  isNap: boolean;
  avgHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  respRate: number | null;
  awakeCount: number | null;
  stages: SleepSegment[] | null;
}

export interface HistoryTrack {
  done: number;
  total: number;
  /** primo giorno scaricato (yyyy-MM-dd) */
  since: string | null;
  complete: boolean;
}

export interface WellnessProgress {
  light: HistoryTrack;
  heart: HistoryTrack;
  complete: boolean;
}

export interface WellnessResponse {
  connected: boolean;
  lastSyncAt: string | null;
  /** storico scaricato: dati leggeri (fino a 3 anni) e battiti al minuto (1 anno) */
  progress: WellnessProgress | null;
  /** token Xiaomi scaduto: lo storico non può avanzare */
  needsReconnect: boolean;
  /** ultimo tipo di dato non scaricato (diagnostica) */
  syncError: string | null;
  days: WellnessDayJson[];
  sleeps: SleepJson[];
}
