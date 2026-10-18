export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_IDS = 40;
const MAX_ID_LENGTH = 60;

type HistoryRow = {
  exerciseId: string;
  session: { startedAt: Date };
  sets: { weight: number | null; reps: number | null }[];
};

/** Ultima esecuzione completata di ogni esercizio, eventualmente solo in un giorno del piano */
function latestByExercise(userId: string, ids: string[], programDayId?: string): Promise<HistoryRow[]> {
  if (!ids.length) return Promise.resolve([]);
  return prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: ids },
      session: { userId, status: "COMPLETED", ...(programDayId ? { programDayId } : {}) },
      sets: { some: { type: { not: "WARMUP" } } },
    },
    orderBy: { session: { startedAt: "desc" } },
    distinct: ["exerciseId"],
    select: {
      exerciseId: true,
      session: { select: { startedAt: true } },
      sets: {
        where: { type: { not: "WARMUP" } },
        orderBy: { setNumber: "asc" },
        select: { weight: true, reps: true },
      },
    },
  });
}

/**
 * Ultima esecuzione di ogni esercizio richiesto, con le serie di lavoro in
 * ordine: serve a precompilare l'allenamento e a proporre la progressione.
 * Con `day` (giorno del piano) si preferisce l'ultima volta che hai fatto
 * proprio quel giorno; se lì l'esercizio non c'è, si usa l'ultima in assoluto.
 * GET /api/exercises/history?ids=a,b,c&day=<programDayId>
 */
export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const params = new URL(req.url).searchParams;
  const ids = Array.from(
    new Set(
      (params.get("ids") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s.length <= MAX_ID_LENGTH)
    )
  ).slice(0, MAX_IDS);
  if (!ids.length) return NextResponse.json({});

  const day = params.get("day")?.trim();
  const programDayId = day && day.length <= MAX_ID_LENGTH ? day : undefined;

  const sameDay = programDayId ? await latestByExercise(userId, ids, programDayId) : [];
  const found = new Set(sameDay.map((r) => r.exerciseId));
  const anyDay = await latestByExercise(
    userId,
    ids.filter((id) => !found.has(id))
  );

  const toEntry = (r: HistoryRow, isSameDay: boolean) =>
    [r.exerciseId, { date: r.session.startedAt, sets: r.sets, sameDay: isSameDay }] as const;

  return NextResponse.json(
    Object.fromEntries([...sameDay.map((r) => toEntry(r, true)), ...anyDay.map((r) => toEntry(r, false))])
  );
}
