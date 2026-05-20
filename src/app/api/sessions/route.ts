export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { MuscleGroup } from "@prisma/client";

const createSessionSchema = z.object({
  workoutType: z.enum(["PUSH", "PULL", "LEGS", "UPPER", "LOWER", "FULL_BODY", "CARDIO", "CUSTOM"]).optional(),
  templateId: z.string().optional(),
  programDayId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = createSessionSchema.parse(body);

  const existing = await prisma.workoutSession.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Workout already in progress" }, { status: 409 });
  }

  const workout = await prisma.workoutSession.create({
    data: {
      userId: session.user.id,
      status: "ACTIVE",
      workoutType: data.workoutType ?? "CUSTOM",
      notes: data.notes,
      templateId: data.templateId,
      programDayId: data.programDayId,
    },
  });

  return NextResponse.json(workout, { status: 201 });
}

export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const muscle = searchParams.get("muscle") ?? undefined;

  const workouts = await prisma.workoutSession.findMany({
    where: {
      userId: session.user.id,
      status: { not: "ABANDONED" },
      ...(muscle ? { exercises: { some: { exercise: { primaryMuscle: muscle as MuscleGroup } } } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      exercises: {
        include: {
          exercise: { select: { name: true, primaryMuscle: true } },
          sets: { where: { type: "WORKING" } },
        },
      },
      _count: { select: { personalRecords: true } },
    },
  });

  return NextResponse.json(workouts);
}
