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

  const suggestedIndex = currentDay % dayCount;

  // Enrich every day's exercises with names, so the user can pick which day of
  // the plan they are actually training today.
  const exerciseIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, name: true, nameIt: true, primaryMuscle: true },
  });
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

  const enrichedDays = program.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => ({
      ...ex,
      exercise: exerciseMap.get(ex.exerciseId) ?? null,
    })),
  }));

  return NextResponse.json({
    ...activeProgram,
    days: enrichedDays,
    todayDay: enrichedDays[suggestedIndex],
    suggestedDayIndex: suggestedIndex,
    totalDays: dayCount,
    weekProgress: Math.floor(currentDay / program.frequency) + 1,
  });
}

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { programId, action, dayIndex } = body;

  if (action === "deactivate") {
    await prisma.activeProgram.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ success: true });
  }

  if (action === "advance") {
    // Called after starting a workout to move on to the next day of the plan.
    // When the user picked a specific day, continue from that one.
    const active = await prisma.activeProgram.findUnique({
      where: { userId: session.user.id },
      include: { program: { include: { days: { select: { id: true } } } } },
    });
    if (!active) return NextResponse.json({ error: "No active program" }, { status: 404 });

    const dayCount = active.program.days.length || 1;
    const nextDay =
      typeof dayIndex === "number"
        ? Math.floor(active.currentDay / dayCount) * dayCount + dayIndex + 1
        : active.currentDay + 1;

    const updated = await prisma.activeProgram.update({
      where: { userId: session.user.id },
      data: { currentDay: nextDay },
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
