import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSessionSchema = z.object({
  status: z.enum(["ACTIVE", "COMPLETED", "ABANDONED", "PAUSED"]).optional(),
  notes: z.string().optional(),
  rating: z.number().min(1).max(10).optional(),
  rpe: z.number().min(1).max(10).optional(),
  mood: z.number().min(1).max(5).optional(),
  energyLevel: z.number().min(1).max(5).optional(),
  workoutType: z.enum(["PUSH", "PULL", "LEGS", "UPPER", "LOWER", "FULL_BODY", "CARDIO", "CUSTOM"]).optional(),
});

interface Params { params: Promise<{ sessionId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workout = await prisma.workoutSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
    include: {
      exercises: {
        include: {
          exercise: true,
          sets: { orderBy: { setNumber: "asc" } },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!workout) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(workout);
}

export async function PATCH(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = updateSessionSchema.parse(body);

  const updates: Record<string, unknown> = { ...data };
  if (data.status === "COMPLETED") {
    updates.endedAt = new Date();
  }

  const workout = await prisma.workoutSession.update({
    where: { id: sessionId, userId: session.user.id },
    data: updates,
  });

  return NextResponse.json(workout);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.workoutSession.update({
    where: { id: sessionId, userId: session.user.id },
    data: { status: "ABANDONED" },
  });

  return NextResponse.json({ success: true });
}
