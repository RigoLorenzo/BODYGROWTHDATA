export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeProgram = await prisma.activeProgram.findUnique({
    where: { userId: session.user.id },
    include: {
      program: {
        include: {
          days: {
            orderBy: { dayIndex: "asc" },
            include: {
              exercises: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!activeProgram) return NextResponse.json(null);

  const { program, currentDay } = activeProgram;
  const dayCount = program.days.length;
  if (dayCount === 0) return NextResponse.json({ ...activeProgram, todayDay: null });

  const todayDay = program.days[currentDay % dayCount];

  // Enrich today's exercises with names
  const exerciseIds = todayDay.exercises.map((e) => e.exerciseId);
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, name: true, primaryMuscle: true },
  });
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const enrichedDay = {
    ...todayDay,
    exercises: todayDay.exercises.map((ex) => ({
      ...ex,
      exercise: exerciseMap.get(ex.exerciseId) ?? null,
    })),
  };

  return NextResponse.json({
    ...activeProgram,
    todayDay: enrichedDay,
    totalDays: dayCount,
    weekProgress: Math.floor(currentDay / program.frequency) + 1,
  });
}

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { programId, action } = body;

  if (action === "deactivate") {
    await prisma.activeProgram.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ success: true });
  }

  if (action === "advance") {
    // Called after completing a workout to advance to the next day
    const active = await prisma.activeProgram.findUnique({ where: { userId: session.user.id } });
    if (!active) return NextResponse.json({ error: "No active program" }, { status: 404 });
    const updated = await prisma.activeProgram.update({
      where: { userId: session.user.id },
      data: { currentDay: active.currentDay + 1 },
    });
    return NextResponse.json(updated);
  }

  if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });

  const program = await prisma.program.findFirst({
    where: { id: programId, creatorId: session.user.id },
  });
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  const active = await prisma.activeProgram.upsert({
    where: { userId: session.user.id },
    update: { programId, currentDay: 0, startedAt: new Date(), completedAt: null },
    create: { userId: session.user.id, programId, currentDay: 0 },
  });

  return NextResponse.json(active);
}
