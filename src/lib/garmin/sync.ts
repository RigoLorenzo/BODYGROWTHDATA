import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { adoptWellnessSource, releaseWellnessSource } from "@/lib/devices/source";
import { saveRun } from "@/lib/run/repository";
import { analyzeTrack } from "@/lib/run/track";
import { updateUserStreak } from "@/lib/streak-calculator";
import {
  GarminClient,
  GarminError,
  downloadActivity,
  exchangeApiKey,
  isGarminAuthError,
  profileSettings,
  searchActivities,
  type GarminToken,
} from "./client";
import { isFit, parseFitRecords } from "./fit";
import { mapActivity } from "./mapping";
import { syncGarminWellness } from "./wellness-sync";
import { extractEntry, isZip } from "./zip";

/**
 * Garmin Connect con la Personal API: stessi passi di Mi Fitness. Prima le
 * corse dall'ultima sincronizzazione, poi il benessere, infine le tracce GPS
 * (file .fit) se resta tempo; una traccia si scarica anche aprendo la corsa.
 */

const DAY_MS = 86_400_000;
/** Il token dura 24 h: si rinnova quando ne manca meno di un'ora */
const TOKEN_REFRESH_MS = 3_600_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const TRACKS_PER_SYNC = 5;
const WELLNESS_BUDGET_MS = 25_000;
const SYNC_LIMIT_MS = 50_000;
const WELLNESS_HARD_STOP_MS = 10_000;
const TRACK_RESERVE_MS = 20_000;

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const tokenData = (token: GarminToken) => ({
  accessToken: encryptSecret(token.accessToken),
  accessTokenExpiresAt: token.expiresAt,
});

/** Chiave scaduta o revocata: lo stato lo mostra e la sincronizzazione automatica si ferma */
async function markAuthError(userId: string, error: unknown) {
  if (isGarminAuthError(error)) {
    await prisma.garminConnection.updateMany({ where: { userId }, data: { lastError: (error as Error).message } });
  }
}

/** Client dal collegamento salvato; il token si riusa finché vale */
export async function openGarmin(userId: string) {
  const conn = await prisma.garminConnection.findUnique({ where: { userId } });
  if (!conn) throw new GarminError("Garmin non collegato");

  const renew = async () => {
    try {
      const token = await exchangeApiKey(decryptSecret(conn.apiKey));
      await prisma.garminConnection.update({ where: { userId }, data: tokenData(token) });
      return token.accessToken;
    } catch (error) {
      await markAuthError(userId, error);
      throw error;
    }
  };
  const fresh = conn.accessToken && conn.accessTokenExpiresAt && conn.accessTokenExpiresAt.getTime() - Date.now() > TOKEN_REFRESH_MS;
  const token = fresh ? decryptSecret(conn.accessToken!) : await renew();
  return { client: new GarminClient(token, renew), conn };
}

/** Collega l'account: verifica la chiave, legge nome e fuso del profilo e salva tutto cifrato */
export async function connectGarmin(userId: string, apiKey: string) {
  const token = await exchangeApiKey(apiKey);
  const client = new GarminClient(token.accessToken, async () => (await exchangeApiKey(apiKey)).accessToken);
  const profile = await profileSettings(client);
  const data = {
    apiKey: encryptSecret(apiKey),
    ...tokenData(token),
    displayName: profile?.displayName?.slice(0, 100) ?? null,
    timeZone: profile?.timeZone?.slice(0, 64) ?? null,
    lastError: null,
  };
  const conn = await prisma.garminConnection.upsert({ where: { userId }, update: data, create: { ...data, userId } });
  await adoptWellnessSource(userId, "GARMIN");
  return conn;
}

/** Scollega: cancella chiave e token (corse e dati benessere restano) */
export async function disconnectGarmin(userId: string) {
  await prisma.garminConnection.deleteMany({ where: { userId } });
  await releaseWellnessSource(userId, "GARMIN");
}

/** Percorso, parziali e migliori tempi dal file .fit dell'attività */
async function attachTrack(client: GarminClient, run: { id: string; externalId: string | null; startedAt: Date; elevationGain: number | null }) {
  if (!run.externalId) return false;
  // L'orologio carica il file con un po' di ritardo: si riprova per un giorno
  const giveUp = () =>
    Date.now() - run.startedAt.getTime() > DAY_MS
      ? prisma.runActivity.update({ where: { id: run.id }, data: { detailed: true } })
      : null;

  const file = await downloadActivity(client, run.externalId).catch(async (error) => {
    if (!(error instanceof GarminError && (error.auth || error.rateLimited))) await giveUp();
    throw error;
  });
  let fit: Buffer | null = null;
  try {
    fit = file && isZip(file) ? (extractEntry(file, (name) => /\.fit$/i.test(name))?.data ?? null) : file;
  } catch (error) {
    console.warn("archivio Garmin non leggibile", run.id, error);
  }
  const records = fit && isFit(fit) ? parseFitRecords(fit) : [];
  const analyzed = analyzeTrack(
    records
      .filter((r) => r.lat != null && r.lon != null)
      .map((r) => ({
        lat: r.lat!,
        lon: r.lon!,
        time: r.time * 1000,
        ...(r.altitude != null ? { ele: r.altitude } : {}),
        ...(r.heartRate != null ? { hr: r.heartRate } : {}),
      }))
  );
  if (!analyzed || analyzed.distance < 100) {
    await giveUp();
    return false;
  }
  await prisma.runActivity.update({
    where: { id: run.id },
    data: {
      polyline: analyzed.polyline,
      splits: analyzed.splits as unknown as Prisma.InputJsonValue,
      bestEfforts: analyzed.bestEfforts as unknown as Prisma.InputJsonValue,
      elevationGain: run.elevationGain ?? analyzed.elevationGain,
      detailed: true,
    },
  });
  return true;
}

/** Dettaglio di una corsa aperta nell'app (se non ancora scaricato) */
export async function importGarminTrack(userId: string, runId: string) {
  const run = await prisma.runActivity.findFirst({
    where: { id: runId, userId, source: "GARMIN", detailed: false },
    select: { id: true, externalId: true, startedAt: true, elevationGain: true },
  });
  if (!run) return false;
  const { client } = await openGarmin(userId);
  return attachTrack(client, run).catch(async (error) => {
    await markAuthError(userId, error);
    throw error;
  });
}

/** Corse dal giorno `since` (locale) a domani, dal più recente */
async function importRuns(userId: string, client: GarminClient, since: number) {
  let imported = 0;
  const endDate = isoDate(Date.now() + DAY_MS);
  for (let page = 0; page < MAX_PAGES; page++) {
    const activities = await searchActivities(client, {
      startDate: isoDate(since),
      endDate,
      start: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    });
    for (const activity of activities) {
      const input = mapActivity(activity);
      if (!input) continue;
      await saveRun(userId, input, { updateStreak: false });
      imported++;
    }
    if (activities.length < PAGE_SIZE) break;
  }
  return imported;
}

/** Solo benessere (storico in arrivo): una chiamata dedicata con più tempo */
export async function syncGarminWellnessOnly(userId: string, budgetMs: number) {
  const { client, conn } = await openGarmin(userId);
  try {
    return await syncGarminWellness(userId, client, conn, Date.now() + budgetMs, { recent: false });
  } catch (error) {
    await markAuthError(userId, error);
    throw error;
  }
}

/**
 * Corse dall'ultima sincronizzazione (3 giorni di margine; un anno al primo
 * collegamento), poi benessere e tracce GPS entro `limitMs`.
 */
export async function syncGarmin(userId: string, opts: { full?: boolean; wellnessBudgetMs?: number; limitMs?: number } = {}) {
  const started = Date.now();
  const limit = started + (opts.limitMs ?? SYNC_LIMIT_MS);
  const { client, conn } = await openGarmin(userId);
  try {
    const since = conn.lastSyncAt && !opts.full ? conn.lastSyncAt.getTime() - 3 * DAY_MS : started - 365 * DAY_MS;
    const imported = await importRuns(userId, client, since);

    // Il benessere non deve far fallire l'import delle corse (salvo chiave scaduta)
    let wellness = 0;
    const wellnessDeadline = Math.min(Date.now() + (opts.wellnessBudgetMs ?? WELLNESS_BUDGET_MS), limit - WELLNESS_HARD_STOP_MS);
    try {
      wellness = await syncGarminWellness(userId, client, conn, wellnessDeadline);
    } catch (error) {
      if (isGarminAuthError(error)) throw error;
      console.warn("benessere Garmin", error);
    }

    const pending = await prisma.runActivity.findMany({
      where: { userId, source: "GARMIN", detailed: false },
      orderBy: { startedAt: "desc" },
      take: TRACKS_PER_SYNC,
      select: { id: true, externalId: true, startedAt: true, elevationGain: true },
    });
    let tracks = 0;
    for (const run of pending) {
      if (Date.now() + TRACK_RESERVE_MS > limit) break;
      const attached = await attachTrack(client, run).catch((error) => {
        if (isGarminAuthError(error)) throw error;
        console.warn("traccia Garmin", run.id, error);
        return false;
      });
      if (attached) tracks++;
    }

    await updateUserStreak(userId);
    await prisma.garminConnection.update({ where: { userId }, data: { lastSyncAt: new Date(), lastError: null } });
    console.info("sync Garmin", JSON.stringify({ imported, wellness, tracks, pendingTracks: pending.length, totalMs: Date.now() - started }));
    return { imported, wellness };
  } catch (error) {
    await markAuthError(userId, error);
    throw error;
  }
}
