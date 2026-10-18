export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withProgramDayNames } from "@/lib/program-day-names";

/** Massimo di sedute restituite: anni di allenamenti in poche decine di KB */
const LIMIT = 3000;

/**
 * Tutte le sedute completate in forma compatta (palestra e corsa): le
 * statistiche si calcolano nel browser, nel fuso orario di chi guarda.
 */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await prisma.workoutSession.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      duration: true,
      totalVolume: true,
      totalSets: true,
      programDayId: true,
      run: { select: { id: true, name: true, distance: true, elapsedTime: true } },
      exercises: { take: 1, orderBy: { orderIndex: "asc" }, select: { exercise: { select: { name: true } } } },
    },
  });
  const named = await withProgramDayNames(sessions);

  const items = named.map((s) => {
    const wall = s.endedAt ? Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000) : 0;
    return {
      id: s.id,
      startedAt: s.startedAt.toISOString(),
      kind: s.run ? "run" : "gym",
      duration: s.run?.elapsedTime ?? s.duration ?? wall,
      volume: Math.round(s.totalVolume),
      sets: s.totalSets,
      distance: s.run?.distance ?? 0,
      title: s.run?.name ?? s.programDayName ?? s.exercises[0]?.exercise.name ?? "Allenamento",
      runId: s.run?.id ?? null,
    };
  });

  return NextResponse.json(items, { headers: { "Cache-Control": "private, max-age=60" } });
}
