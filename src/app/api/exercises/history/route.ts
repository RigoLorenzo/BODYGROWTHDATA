export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_IDS = 40;

/**
 * Ultima esecuzione completata di ogni esercizio richiesto, con le serie di
 * lavoro in ordine: serve a precompilare l'allenamento e a proporre la
 * progressione. GET /api/exercises/history?ids=a,b,c
 */
export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = Array.from(
    new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))
  ).slice(0, MAX_IDS);
  if (!ids.length) return NextResponse.json({});

  const rows = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: ids },
      session: { userId: session.user.id, status: "COMPLETED" },
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

  return NextResponse.json(
    Object.fromEntries(rows.map((r) => [r.exerciseId, { date: r.session.startedAt, sets: r.sets }]))
  );
}
