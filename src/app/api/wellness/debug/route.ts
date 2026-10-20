export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFitnessData, type FitnessRecord } from "@/lib/mifitness/client";
import { withMiFitnessSession } from "@/lib/mifitness/sync";

/**
 * Diagnostica del benessere (solo per l'utente collegato): quali chiavi del
 * cloud Xiaomi hanno dati e in quali periodi, e cosa c'è nel database.
 * Mostra conteggi, date e nomi dei campi, mai i valori.
 */

const KEYS = [
  "sleep",
  "watch_night_sleep",
  "watch_day_sleep",
  "night_sleep",
  "steps",
  "calories",
  "heart_rate",
  "resting_heart_rate",
  "stress",
  "spo2",
];
/** Nomi alternativi per stress e SpO2 (provati su meno periodi, per stare nei 60 s) */
const EXTRA_KEYS = [
  "single_stress",
  "all_day_stress",
  "stress_record",
  "manual_stress",
  "single_spo2",
  "blood_oxygen",
  "spo2_record",
  "manual_spo2",
  "huami_all_day_stress_record",
  "huami_manual_measure_record",
];
/** Finestre di 3 giorni a ritroso: oggi, 1 settimana, 1, 3, 6 e 12 mesi */
const DAYS_AGO = [0, 7, 30, 90, 180, 365];
const EXTRA_DAYS_AGO = [0, 30];
const DAY = 86_400;
const PARALLEL = 6;

const isoTime = (t?: number) => (t ? new Date(t * 1000).toISOString().slice(0, 16) : null);

function payloadOf(record: FitnessRecord): Record<string, unknown> {
  try {
    const value = typeof record.value === "string" ? JSON.parse(record.value) : record.value;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const fieldsOf = (record: FitnessRecord | undefined) => (record ? Object.keys(payloadOf(record)).sort() : null);

/** Orario del dato: in cima al record o, per alcuni tipi, solo dentro il valore */
function timeOf(record: FitnessRecord): number | null {
  const p = payloadOf(record);
  for (const t of [record.time, p.time, p.date_time, p.wake_up_time, p.bedtime]) {
    if (typeof t === "number" && t > 0) return t;
  }
  return null;
}

function span(records: FitnessRecord[]) {
  const times = records.map(timeOf).filter((t): t is number => t != null);
  if (!times.length) return { from: null, to: null };
  return { from: isoTime(Math.min(...times)), to: isoTime(Math.max(...times)) };
}

async function probeCloud(userId: string) {
  return withMiFitnessSession(userId, async (session, region) => {
    const now = Math.floor(Date.now() / 1000);
    const jobs = [
      ...KEYS.flatMap((key) => DAYS_AGO.map((ago) => ({ key, ago }))),
      ...EXTRA_KEYS.flatMap((key) => EXTRA_DAYS_AGO.map((ago) => ({ key, ago }))),
    ];
    const results: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < jobs.length; i += PARALLEL) {
      await Promise.all(
        jobs.slice(i, i + PARALLEL).map(async ({ key, ago }) => {
          const endTime = now - ago * DAY;
          const label = ago ? `${ago} giorni fa` : "ultimi 3 giorni";
          try {
            const page = await listFitnessData(session, region, { key, startTime: endTime - 3 * DAY, endTime });
            (results[key] ??= {})[label] = page.records.length
              ? { records: page.records.length, hasMore: page.hasMore, ...span(page.records), fields: fieldsOf(page.records[0]) }
              : 0;
          } catch (error) {
            (results[key] ??= {})[label] = `errore: ${error instanceof Error ? error.message : "sconosciuto"}`;
          }
        })
      );
    }
    return { region, keys: results };
  });
}

async function summarizeDb(userId: string) {
  const [conn, days, sleeps] = await Promise.all([
    prisma.miFitnessConnection.findUnique({
      where: { userId },
      select: {
        region: true,
        lastSyncAt: true,
        lastError: true,
        wellnessSyncedFrom: true,
        wellnessSyncedUntil: true,
        wellnessHrFrom: true,
        wellnessHrUntil: true,
        wellnessZoneOffset: true,
        wellnessError: true,
      },
    }),
    prisma.wellnessDay.findMany({
      where: { userId },
      select: { date: true, steps: true, restingHr: true, avgHr: true, stressAvg: true, spo2Avg: true },
      orderBy: { date: "asc" },
    }),
    prisma.sleepSession.findMany({ where: { userId }, select: { date: true, isNap: true }, orderBy: { date: "asc" } }),
  ]);
  const span = (dates: string[]) => ({ count: dates.length, first: dates[0] ?? null, last: dates.at(-1) ?? null });
  const daysWith = (field: keyof (typeof days)[number]) => span(days.filter((d) => d[field] != null).map((d) => d.date));
  return {
    connection: conn,
    days: span(days.map((d) => d.date)),
    steps: daysWith("steps"),
    restingHr: daysWith("restingHr"),
    heartRate: daysWith("avgHr"),
    stress: daysWith("stressAvg"),
    spo2: daysWith("spo2Avg"),
    sleeps: span(sleeps.filter((s) => !s.isNap).map((s) => s.date)),
  };
}

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const database = await summarizeDb(userId);
  const cloud = await probeCloud(userId).catch((error) => ({
    error: error instanceof Error ? error.message : "Xiaomi non raggiungibile",
  }));
  return new NextResponse(JSON.stringify({ database, cloud }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
