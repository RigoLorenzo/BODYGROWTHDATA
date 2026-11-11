export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWorkoutShareStats } from "@/lib/workout-share";
import { sessionTotals } from "@/lib/session-compare";

interface Params {
  params: Promise<{ sessionId: string }>;
}

/** L'ultima seduta completata dello stesso giorno del piano, prima di questa (null se non c'è) */
export async function GET(_req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const current = await prisma.workoutSession.findUnique({
    where: { id: sessionId, userId },
    select: { programDayId: true, startedAt: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!current.programDayId) return NextResponse.json(null);

  const previous = await prisma.workoutSession.findFirst({
    where: {
      userId,
      programDayId: current.programDayId,
      status: "COMPLETED",
      startedAt: { lt: current.startedAt },
      id: { not: sessionId },
    },
    orderBy: { startedAt: "desc" },
    include: { exercises: { include: { exercise: true, sets: true } } },
  });
  if (!previous) return NextResponse.json(null);
  return NextResponse.json(sessionTotals(previous.startedAt, buildWorkoutShareStats(previous)), {
    headers: { "Cache-Control": "no-store" },
  });
}
