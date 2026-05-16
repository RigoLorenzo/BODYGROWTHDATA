export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addExerciseSchema = z.object({
  exerciseId: z.string(),
  orderIndex: z.number().optional(),
  restTimerSeconds: z.number().optional(),
  notes: z.string().optional(),
});

interface Params { params: Promise<{ sessionId: string }> }

export async function POST(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workout = await prisma.workoutSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
  });
  if (!workout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data = addExerciseSchema.parse(body);

  const count = await prisma.workoutExercise.count({ where: { sessionId } });

  const exercise = await prisma.workoutExercise.create({
    data: {
      sessionId,
      exerciseId: data.exerciseId,
      orderIndex: data.orderIndex ?? count,
      restTimerSeconds: data.restTimerSeconds ?? 90,
      notes: data.notes,
    },
    include: { exercise: true },
  });

  return NextResponse.json(exercise, { status: 201 });
}
