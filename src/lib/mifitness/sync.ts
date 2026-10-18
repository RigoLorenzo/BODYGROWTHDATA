import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { deleteRun, saveRun } from "@/lib/run/repository";
import { analyzeTrack } from "@/lib/run/track";
import { updateUserStreak } from "@/lib/streak-calculator";
import { MiFitnessError, discoverRegion, downloadGpsTrack, listSportRecords, login, type XiaomiSession } from "./client";
import { mapSportRecord, parseExternalId } from "./mapping";

/** Sessione dal collegamento salvato; il passToken ruotato viene risalvato */
async function openSession(userId: string) {
  const conn = await prisma.miFitnessConnection.findUnique({ where: { userId } });
  if (!conn) throw new MiFitnessError("Mi Fitness non collegato");
  try {
    const session = await login(conn.xiaomiId, decryptSecret(conn.passToken));
    if (session.passToken !== decryptSecret(conn.passToken)) {
      await prisma.miFitnessConnection.update({ where: { userId }, data: { passToken: encryptSecret(session.passToken) } });
    }
    return { session, conn };
  } catch (error) {
    if (error instanceof MiFitnessError && error.auth) {
      await prisma.miFitnessConnection.update({ where: { userId }, data: { lastError: error.message } });
    }
    throw error;
  }
}

/** Collega l'account: verifica il token, trova la regione e lo salva cifrato */
export async function connectMiFitness(userId: string, xiaomiId: string, passToken: string) {
  const session = await login(xiaomiId, passToken);
  const region = await discoverRegion(session);
  const data = {
    xiaomiId: session.userId,
    passToken: encryptSecret(session.passToken),
    region,
    lastError: null,
  };
  // Lo stesso account Xiaomi collegato a un altro utente passa a questo
  await prisma.miFitnessConnection.deleteMany({ where: { xiaomiId: data.xiaomiId, NOT: { userId } } });
  return prisma.miFitnessConnection.upsert({ where: { userId }, update: data, create: { ...data, userId } });
}

export async function disconnectMiFitness(userId: string) {
  await prisma.miFitnessConnection.deleteMany({ where: { userId } });
}

/** Percorso, parziali e migliori tempi dalla traccia GPS */
async function attachTrack(session: XiaomiSession, region: string, run: { id: string; externalId: string | null; startedAt: Date; elevationGain: number | null }) {
  const ctx = run.externalId ? parseExternalId(run.externalId) : null;
  if (!ctx) return false;
  const samples = await downloadGpsTrack(session, region, ctx);
  const analyzed = analyzeTrack(
    samples.map((s) => ({ lat: s.lat, lon: s.lon, time: s.time * 1000, ...(s.altitude != null ? { ele: s.altitude } : {}) }))
  );
  if (!analyzed || analyzed.distance < 100) {
    // L'orologio carica i file con un po' di ritardo: si riprova per un giorno
    if (Date.now() - run.startedAt.getTime() > 86_400_000) {
      await prisma.runActivity.update({ where: { id: run.id }, data: { detailed: true } });
    }
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
export async function importMiFitnessTrack(userId: string, runId: string) {
  const run = await prisma.runActivity.findFirst({
    where: { id: runId, userId, source: "MI_FITNESS", detailed: false },
    select: { id: true, externalId: true, startedAt: true, elevationGain: true },
  });
  if (!run) return false;
  const { session, conn } = await openSession(userId);
  return attachTrack(session, conn.region, run);
}

const DAY = 86_400;
/** Tracce scaricate per sincronizzazione: le altre all'apertura della corsa */
const TRACKS_PER_SYNC = 5;

/**
 * Scarica gli allenamenti di corsa dall'ultima sincronizzazione (con 3 giorni
 * di margine; un anno al primo collegamento) e le tracce delle più recenti.
 */
export async function syncMiFitness(userId: string, opts: { full?: boolean } = {}) {
  const { session, conn } = await openSession(userId);
  const now = Math.floor(Date.now() / 1000);
  const since =
    conn.lastSyncAt && !opts.full ? Math.floor(conn.lastSyncAt.getTime() / 1000) - 3 * DAY : now - 365 * DAY;

  let imported = 0;
  let nextKey: string | null = null;
  for (let page = 0; page < 20; page++) {
    const result = await listSportRecords(session, conn.region, { startTime: since, endTime: now + DAY, nextKey });
    for (const record of result.records) {
      const input = mapSportRecord(record);
      if (!input) continue;
      if (record.deleted) {
        const existing = await prisma.runActivity.findFirst({
          where: { userId, source: "MI_FITNESS", externalId: input.externalId },
          select: { id: true },
        });
        if (existing) await deleteRun(userId, existing.id);
        continue;
      }
      await saveRun(userId, input, { updateStreak: false });
      imported++;
    }
    if (!result.hasMore || !result.nextKey) break;
    nextKey = result.nextKey;
  }

  const pending = await prisma.runActivity.findMany({
    where: { userId, source: "MI_FITNESS", detailed: false },
    orderBy: { startedAt: "desc" },
    take: TRACKS_PER_SYNC,
    select: { id: true, externalId: true, startedAt: true, elevationGain: true },
  });
  for (const run of pending) {
    await attachTrack(session, conn.region, run).catch((error) => console.warn("traccia Mi Fitness", run.id, error));
  }

  await prisma.miFitnessConnection.update({ where: { userId }, data: { lastSyncAt: new Date(), lastError: null } });
  await updateUserStreak(userId);
  return imported;
}
