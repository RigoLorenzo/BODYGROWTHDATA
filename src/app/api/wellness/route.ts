export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEVICES } from "@/lib/devices/registry";
import { wellnessSourceState } from "@/lib/devices/source";
import type { SleepSegment, WellnessResponse } from "@/lib/wellness/types";

const MAX_DAYS = 3 * 365;
const DEFAULT_DAYS = 400;
/** L'ipnogramma si mostra solo per le notti recenti: il resto pesa e basta */
const DETAIL_DAYS = 14;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Giorni e notti dello smartwatch scelto come fonte; le analisi si calcolano nel browser */
export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const requested = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_DAYS) : DEFAULT_DAYS;
  const since = isoDay(new Date(Date.now() - days * 86_400_000));

  const source = await wellnessSourceState(userId);
  const [state, rows, sleeps] = await Promise.all([
    source.active ? DEVICES[source.active].wellness(userId) : null,
    prisma.wellnessDay.findMany({
      where: { userId, source: source.shown, date: { gte: since } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        steps: true,
        distance: true,
        activeCalories: true,
        restingHr: true,
        avgHr: true,
        minHr: true,
        maxHr: true,
        spo2Avg: true,
        spo2Min: true,
        stressAvg: true,
        stressMax: true,
      },
    }),
    prisma.sleepSession.findMany({
      where: { userId, source: source.shown, date: { gte: since } },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        date: true,
        startAt: true,
        endAt: true,
        duration: true,
        asleep: true,
        deep: true,
        light: true,
        rem: true,
        awake: true,
        score: true,
        isNap: true,
        avgHr: true,
        minHr: true,
        maxHr: true,
        respRate: true,
        awakeCount: true,
        stages: true,
      },
    }),
  ]);

  const detailSince = isoDay(new Date(Date.now() - DETAIL_DAYS * 86_400_000));
  const body: WellnessResponse = {
    connected: !!state,
    source: source.active,
    sources: source.connected,
    lastSyncAt: state?.lastSyncAt?.toISOString() ?? null,
    progress: state?.progress ?? null,
    needsReconnect: !!state?.lastError,
    syncError: state?.wellnessError ?? null,
    days: rows,
    sleeps: sleeps.map((s) => ({
      ...s,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      stages: s.date >= detailSince ? ((s.stages as unknown as SleepSegment[] | null) ?? null) : null,
    })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
}
