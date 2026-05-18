export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findFirst({
    where: { id, creatorId: session.user.id },
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          exercises: {
            orderBy: { orderIndex: "asc" },
            include: {
              day: false,
            },
          },
        },
      },
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enrich with exercise names
  const exerciseIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, name: true, primaryMuscle: true },
  });
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const enriched = {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        exercise: exerciseMap.get(ex.exerciseId) ?? null,
      })),
    })),
  };

  return NextResponse.json(enriched);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const program = await prisma.program.findFirst({ where: { id, creatorId: session.user.id } });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deactivate if active
  await prisma.activeProgram.deleteMany({ where: { userId: session.user.id, programId: id } });
  await prisma.program.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
