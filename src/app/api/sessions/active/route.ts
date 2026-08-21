export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Allenamento attualmente aperto sul server (o null).
 * Serve a ritrovare una sessione iniziata su un altro dispositivo/browser,
 * dove lo stato locale non c'è.
 */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workout = await prisma.workoutSession.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          exercise: { select: { id: true, name: true, nameIt: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });

  return NextResponse.json(workout);
}
