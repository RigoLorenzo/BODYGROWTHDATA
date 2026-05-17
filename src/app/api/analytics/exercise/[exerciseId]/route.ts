export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { calculateOneRM } from "@/lib/one-rm-calculator";

interface Params { params: Promise<{ exerciseId: string }> }

export async function GET(req: Request, { params }: Params) {
  const { exerciseId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isLast = searchParams.get("last") === "true";

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      status: "COMPLETED",
      exercises: { some: { exerciseId } },
    },
    orderBy: { startedAt: isLast ? "desc" : "asc" },
    take: isLast ? 1 : 60,
    select: {
      startedAt: true,
      exercises: {
        where: { exerciseId },
        include: {
          sets: {
            where: { type: { not: "WARMUP" }, weight: { not: null }, reps: { not: null } },
          },
        },
      },
    },
  });

  const data = sessions.flatMap((s) =>
    s.exercises.map((ex) => {
      const workingSets = ex.sets.filter((set) => set.weight && set.reps);
      if (!workingSets.length) return null;
      const maxWeightSet = workingSets.reduce((max, set) =>
        (set.weight ?? 0) > (max.weight ?? 0) ? set : max
      );
      const maxWeight = maxWeightSet.weight ?? 0;
      const maxReps = maxWeightSet.reps ?? 0;
      const volume = workingSets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
      const oneRM = calculateOneRM(maxWeight, maxReps);

      return {
        date: format(s.startedAt, "d MMM"),
        maxWeight,
        maxReps,
        volume,
        oneRM: Math.round(oneRM * 10) / 10,
      };
    })
  ).filter(Boolean);

  return NextResponse.json(data);
}
