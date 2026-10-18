export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { startOfMonth, startOfWeek, startOfYear, subDays } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fitnessSeries, formLabel, DEFAULT_MAX_HR, DEFAULT_RESTING_HR } from "@/lib/run/load";
import { highlights, personalRecords, totals, weeklyTotals } from "@/lib/run/stats";

/** Tutto quello che serve alla sezione Corsa, in una richiesta */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const now = new Date();

  const [runs, profile, strava] = await Promise.all([
    prisma.runActivity.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        distance: true,
        movingTime: true,
        elevationGain: true,
        bestEfforts: true,
        trainingLoad: true,
      },
    }),
    prisma.profile.findUnique({
      where: { userId },
      select: { maxHeartRate: true, restingHeartRate: true, weeklyRunKmGoal: true },
    }),
    prisma.stravaConnection.findUnique({ where: { userId }, select: { athleteName: true, lastSyncAt: true } }),
  ]);

  const since = (from: Date) => runs.filter((r) => r.startedAt >= from);
  // Ultimi 120 giorni per le medie del carico, mostrati 90
  const series = fitnessSeries(
    since(subDays(now, 120)).map((r) => ({ date: r.startedAt, load: r.trainingLoad ?? 0 })),
    90,
    now
  );
  const today = series[series.length - 1];
  const prs = personalRecords(runs);
  const { longest, fastest } = highlights(runs);
  const lastFourWeeks = since(subDays(now, 28));

  return NextResponse.json({
    week: totals(since(startOfWeek(now, { weekStartsOn: 1 }))),
    month: totals(since(startOfMonth(now))),
    year: totals(since(startOfYear(now))),
    allTime: totals(runs),
    weekly: weeklyTotals(runs, 12, now),
    // Frequenza: corse a settimana nelle ultime 4 settimane
    runsPerWeek: Math.round((lastFourWeeks.length / 4) * 10) / 10,
    records: prs,
    longest: longest && { id: longest.id, distance: longest.distance, startedAt: longest.startedAt },
    fastest: fastest && { id: fastest.id, distance: fastest.distance, movingTime: fastest.movingTime, startedAt: fastest.startedAt },
    fitness: { series, today: today ?? null, label: today ? formLabel(today.form) : null },
    settings: {
      maxHeartRate: profile?.maxHeartRate ?? null,
      restingHeartRate: profile?.restingHeartRate ?? null,
      weeklyRunKmGoal: profile?.weeklyRunKmGoal ?? null,
      defaults: { maxHeartRate: DEFAULT_MAX_HR, restingHeartRate: DEFAULT_RESTING_HR },
    },
    strava: strava ? { athleteName: strava.athleteName, lastSyncAt: strava.lastSyncAt } : null,
  });
}
