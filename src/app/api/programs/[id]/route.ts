export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { programInputSchema } from "@/lib/program-schema";
import { assertExercisesUsable, InvalidExercisesError, updateProgram } from "@/lib/program-writer";

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
        include: { exercises: { orderBy: { orderIndex: "asc" } } },
      },
      activations: { where: { userId: session.user.id }, select: { currentDay: true } },
    },
  });

  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Nomi degli esercizi (ProgramExercise non ha la relazione diretta)
  const exerciseIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, name: true, nameIt: true, primaryMuscle: true, muscleGroups: true, muscleContributions: true },
  });
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const { activations, ...rest } = program;

  return NextResponse.json({
    ...rest,
    isActive: activations.length > 0,
    days: program.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({ ...ex, exercise: exerciseMap.get(ex.exerciseId) ?? null })),
    })),
  });
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = programInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  const program = await prisma.program.findFirst({ where: { id, creatorId: session.user.id }, select: { id: true } });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await prisma.$transaction(
      async (tx) => {
        await assertExercisesUsable(tx, session.user.id, parsed.data);
        await updateProgram(tx, id, parsed.data);
      },
      { timeout: 20_000 }
    );
  } catch (error) {
    if (error instanceof InvalidExercisesError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ success: true, id });
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
