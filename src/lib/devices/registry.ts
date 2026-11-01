import type { ActivitySource, DeviceProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isGarminAuthError } from "@/lib/garmin/client";
import { disconnectGarmin, importGarminTrack, syncGarmin, syncGarminWellnessOnly } from "@/lib/garmin/sync";
import { MiFitnessError } from "@/lib/mifitness/client";
import { disconnectMiFitness, importMiFitnessTrack, syncMiFitness, syncWellnessOnly } from "@/lib/mifitness/sync";
import { GARMIN_HEART_TRACK, GARMIN_LIGHT_TRACK, wellnessProgress } from "@/lib/wellness/plan";
import { firstWellnessDay } from "@/lib/wellness/store";
import type { WellnessProgress } from "@/lib/wellness/types";

/**
 * Dispositivi collegabili, tutti con le stesse operazioni: chi aggiunge un
 * orologio scrive il suo modulo (client, mapping, sync) e una voce qui.
 */

export interface DeviceSyncOptions {
  full?: boolean;
  wellnessBudgetMs?: number;
  limitMs?: number;
}

export interface DeviceStatus {
  provider: DeviceProvider;
  /** account collegato (id Xiaomi, nome Garmin) */
  account: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export interface DeviceWellnessState {
  lastSyncAt: Date | null;
  lastError: string | null;
  wellnessError: string | null;
  progress: WellnessProgress;
}

export interface DeviceAdapter {
  provider: DeviceProvider;
  label: string;
  /** fonte con cui si salvano le sue corse */
  activitySource: ActivitySource;
  status(userId: string): Promise<DeviceStatus | null>;
  sync(userId: string, opts?: DeviceSyncOptions): Promise<{ imported: number; wellness: number }>;
  /** Un passo dello storico benessere entro `budgetMs` */
  syncWellnessHistory(userId: string, budgetMs: number): Promise<number>;
  wellness(userId: string): Promise<DeviceWellnessState | null>;
  /** Traccia GPS di una corsa aperta nell'app */
  importTrack(userId: string, runId: string): Promise<boolean>;
  disconnect(userId: string): Promise<void>;
  /** Utenti da aggiornare di notte: collegati e senza errori di accesso */
  cronUserIds(): Promise<string[]>;
  /** Errore che richiede di ricollegare l'account */
  isAuthError(error: unknown): boolean;
}

const coverageSelect = {
  lastSyncAt: true,
  lastError: true,
  wellnessError: true,
  wellnessSyncedFrom: true,
  wellnessHrFrom: true,
} as const;

const miFitness: DeviceAdapter = {
  provider: "MI_FITNESS",
  label: "Mi Fitness",
  activitySource: "MI_FITNESS",
  async status(userId) {
    const conn = await prisma.miFitnessConnection.findUnique({
      where: { userId },
      select: { xiaomiId: true, lastSyncAt: true, lastError: true, createdAt: true },
    });
    return conn && { provider: "MI_FITNESS", account: conn.xiaomiId, ...conn };
  },
  sync: (userId, opts) => syncMiFitness(userId, opts),
  syncWellnessHistory: (userId, budgetMs) => syncWellnessOnly(userId, budgetMs),
  async wellness(userId) {
    const conn = await prisma.miFitnessConnection.findUnique({ where: { userId }, select: coverageSelect });
    if (!conn) return null;
    return { ...conn, progress: wellnessProgress(conn, await firstWellnessDay(userId, "MI_FITNESS")) };
  },
  importTrack: importMiFitnessTrack,
  disconnect: disconnectMiFitness,
  cronUserIds: async () =>
    (await prisma.miFitnessConnection.findMany({ where: { lastError: null }, select: { userId: true } })).map((c) => c.userId),
  isAuthError: (error) => error instanceof MiFitnessError && error.auth,
};

const garmin: DeviceAdapter = {
  provider: "GARMIN",
  label: "Garmin",
  activitySource: "GARMIN",
  async status(userId) {
    const conn = await prisma.garminConnection.findUnique({
      where: { userId },
      select: { displayName: true, lastSyncAt: true, lastError: true, createdAt: true },
    });
    return conn && { provider: "GARMIN", account: conn.displayName, ...conn };
  },
  sync: (userId, opts) => syncGarmin(userId, opts),
  syncWellnessHistory: (userId, budgetMs) => syncGarminWellnessOnly(userId, budgetMs),
  async wellness(userId) {
    const conn = await prisma.garminConnection.findUnique({ where: { userId }, select: coverageSelect });
    if (!conn) return null;
    const first = await firstWellnessDay(userId, "GARMIN");
    return { ...conn, progress: wellnessProgress(conn, first, { light: GARMIN_LIGHT_TRACK, heart: GARMIN_HEART_TRACK }) };
  },
  importTrack: importGarminTrack,
  disconnect: disconnectGarmin,
  cronUserIds: async () =>
    (await prisma.garminConnection.findMany({ where: { lastError: null }, select: { userId: true } })).map((c) => c.userId),
  isAuthError: isGarminAuthError,
};

export const DEVICES: Record<DeviceProvider, DeviceAdapter> = { MI_FITNESS: miFitness, GARMIN: garmin };

/** Dispositivo che ha importato una corsa (null per Strava, GPX, manuale) */
export const deviceForActivity = (source: ActivitySource) =>
  Object.values(DEVICES).find((d) => d.activitySource === source) ?? null;
