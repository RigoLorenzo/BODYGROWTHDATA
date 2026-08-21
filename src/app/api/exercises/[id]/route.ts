export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { MuscleGroup, Equipment } from "@prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameIt: z.string().max(100).optional(),
  primaryMuscle: z.string().optional(),
  muscleGroups: z.array(z.string()).optional(),
  category: z.enum(["COMPOUND", "ISOLATION", "CARDIO", "STRETCHING"]).optional(),
  equipment: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise || exercise.createdById !== session.user.id || !exercise.isCustom) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data = updateSchema.parse(body);

  const muscleGroups = data.primaryMuscle
    ? Array.from(new Set([data.primaryMuscle, ...(data.muscleGroups ?? [])]))
    : data.muscleGroups;

  const updated = await prisma.exercise.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.nameIt !== undefined && { nameIt: data.nameIt.trim() || null }),
      ...(data.primaryMuscle && { primaryMuscle: data.primaryMuscle as MuscleGroup }),
      ...(muscleGroups && { muscleGroups: muscleGroups as MuscleGroup[] }),
      ...(data.category && { category: data.category as never }),
      ...(data.equipment && { equipment: data.equipment as Equipment[] }),
    },
    select: {
      id: true, name: true, nameIt: true, aliases: true, category: true,
      muscleGroups: true, primaryMuscle: true, equipment: true,
      difficulty: true, isCustom: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    include: { _count: { select: { workoutExercises: true } } },
  });

  if (!exercise || exercise.createdById !== session.user.id || !exercise.isCustom) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (exercise._count.workoutExercises > 0) {
    return NextResponse.json(
      { error: "Esercizio in uso in allenamenti esistenti" },
      { status: 409 }
    );
  }

  await prisma.exercise.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
