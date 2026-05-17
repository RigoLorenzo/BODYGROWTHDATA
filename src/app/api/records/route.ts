export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await prisma.personalRecord.findMany({
    where: { userId: session.user.id },
    orderBy: { dateAchieved: "desc" },
    include: {
      exercise: { select: { name: true, primaryMuscle: true } },
    },
  });

  // Keep only the most recent (= current best) per exercise+type pair
  const seen = new Set<string>();
  const best = records.filter((r) => {
    const key = `${r.exerciseId}-${r.recordType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group by exercise
  const grouped = new Map<string, {
    exerciseId: string;
    exercise: { name: string; primaryMuscle: string | null };
    records: typeof best;
  }>();

  for (const r of best) {
    if (!grouped.has(r.exerciseId)) {
      grouped.set(r.exerciseId, { exerciseId: r.exerciseId, exercise: r.exercise, records: [] });
    }
    grouped.get(r.exerciseId)!.records.push(r);
  }

  const result = Array.from(grouped.values()).sort((a, b) =>
    a.exercise.name.localeCompare(b.exercise.name)
  );

  return NextResponse.json(result);
}
