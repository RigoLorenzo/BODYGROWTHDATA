export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { subWeeks } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bestEstimatedOneRM } from "@/lib/one-rm-calculator";

/** Finestra in cui si misura il progresso di ogni esercizio */
const WINDOW_WEEKS = 8;

/**
 * Gli esercizi che fai davvero, dal più frequente: massimale stimato attuale
 * e variazione nelle ultime 8 settimane (prima vs ultima seduta della finestra).
 */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.workoutExercise.findMany({
    where: { session: { userId: session.user.id, status: "COMPLETED" } },
    orderBy: { session: { startedAt: "asc" } },
    select: {
      exerciseId: true,
      exercise: { select: { name: true, primaryMuscle: true } },
      session: { select: { startedAt: true } },
      sets: {
        where: { type: { not: "WARMUP" }, weight: { gt: 0 }, reps: { gt: 0 } },
        select: { weight: true, reps: true },
      },
    },
  });

  const since = subWeeks(new Date(), WINDOW_WEEKS);
  const byExercise = new Map<
    string,
    { id: string; name: string; muscle: string | null; sessions: number; lastDate: Date; best: number; points: { date: Date; oneRM: number }[] }
  >();
  for (const row of rows) {
    const estimate = bestEstimatedOneRM(row.sets);
    const entry = byExercise.get(row.exerciseId) ?? {
      id: row.exerciseId,
      name: row.exercise.name,
      muscle: row.exercise.primaryMuscle,
      sessions: 0,
      lastDate: row.session.startedAt,
      best: 0,
      points: [],
    };
    entry.sessions++;
    entry.lastDate = row.session.startedAt;
    if (estimate) {
      entry.best = Math.max(entry.best, estimate.oneRM);
      entry.points.push({ date: row.session.startedAt, oneRM: estimate.oneRM });
    }
    byExercise.set(row.exerciseId, entry);
  }

  const result = Array.from(byExercise.values())
    .filter((e) => e.points.length > 0)
    .map((e) => {
      const recent = e.points.filter((p) => p.date >= since);
      const first = recent[0]?.oneRM ?? null;
      const last = recent[recent.length - 1]?.oneRM ?? null;
      return {
        id: e.id,
        name: e.name,
        muscle: e.muscle,
        sessions: e.sessions,
        lastDate: e.lastDate.toISOString(),
        bestOneRM: Math.round(e.best * 10) / 10,
        currentOneRM: last != null ? Math.round(last * 10) / 10 : null,
        // Serve almeno due sedute nella finestra per parlare di progresso
        changePercent: recent.length >= 2 && first ? Math.round(((last! - first) / first) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
}
