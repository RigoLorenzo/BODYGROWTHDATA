export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { HourlyHr, SleepSegment, WellnessResponse } from "@/lib/wellness/types";

const MAX_DAYS = 365;
const DEFAULT_DAYS = 120;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Giorni e notti dallo smartwatch; le analisi si calcolano nel browser */
export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const requested = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_DAYS) : DEFAULT_DAYS;
  const since = isoDay(new Date(Date.now() - days * 86_400_000));

  const [conn, rows, sleeps] = await Promise.all([
    prisma.miFitnessConnection.findUnique({ where: { userId }, select: { lastSyncAt: true, wellnessSyncedFrom: true } }),
    prisma.wellnessDay.findMany({
      where: { userId, date: { gte: since } },
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
        hrHourly: true,
        spo2Avg: true,
        spo2Min: true,
        stressAvg: true,
        stressMax: true,
      },
    }),
    prisma.sleepSession.findMany({
      where: { userId, date: { gte: since } },
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
        stages: true,
      },
    }),
  ]);

  const body: WellnessResponse = {
    connected: !!conn,
    lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
    syncedFrom: conn?.wellnessSyncedFrom ? isoDay(conn.wellnessSyncedFrom) : null,
    days: rows.map((r) => ({ ...r, hrHourly: (r.hrHourly as unknown as HourlyHr[] | null) ?? null })),
    sleeps: sleeps.map((s) => ({
      ...s,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      stages: (s.stages as unknown as SleepSegment[] | null) ?? null,
    })),
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=60" } });
}
