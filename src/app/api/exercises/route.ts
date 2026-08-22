export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { MuscleGroup, Equipment } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim();
  // Ogni parola deve comparire nel nome inglese, in quello italiano o negli alias:
  // così "trazioni sbarra" trova "Trazioni alla sbarra".
  const tokens = query ? query.split(/\s+/).slice(0, 4) : [];
  const muscle = searchParams.get("muscle");
  const equipment = searchParams.get("equipment");

  const exercises = await prisma.exercise.findMany({
    where: {
      AND: [
        {
          OR: [
            { isPublic: true },
            { createdById: session.user.id },
          ],
        },
        ...tokens.map((token) => ({
          OR: [
            { name: { contains: token, mode: "insensitive" as const } },
            { nameIt: { contains: token, mode: "insensitive" as const } },
            { aliases: { has: token.toLowerCase() } },
            { tags: { has: token.toLowerCase() } },
          ],
        })),
        muscle ? { muscleGroups: { has: muscle as MuscleGroup } } : {},
        equipment ? { equipment: { has: equipment as Equipment } } : {},
      ],
    },
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    take: 120,
    select: {
      id: true,
      name: true,
      nameIt: true,
      aliases: true,
      category: true,
      muscleGroups: true,
      primaryMuscle: true,
      equipment: true,
      difficulty: true,
      isCustom: true,
    },
  });

  return NextResponse.json(exercises);
}

const createExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  nameIt: z.string().max(100).optional(),
  primaryMuscle: z.string().min(1),
  muscleGroups: z.array(z.string()).default([]),
  category: z.enum(["COMPOUND", "ISOLATION", "CARDIO", "STRETCHING"]).default("COMPOUND"),
  equipment: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = createExerciseSchema.parse(body);

  const muscleGroups = Array.from(new Set([data.primaryMuscle, ...data.muscleGroups]));

  const exercise = await prisma.exercise.create({
    data: {
      name: data.name,
      nameIt: data.nameIt?.trim() || null,
      primaryMuscle: data.primaryMuscle as MuscleGroup,
      muscleGroups: muscleGroups as MuscleGroup[],
      category: data.category as never,
      equipment: data.equipment as Equipment[],
      isCustom: true,
      isPublic: false,
      createdById: session.user.id,
    },
    select: {
      id: true,
      name: true,
      nameIt: true,
      aliases: true,
      category: true,
      muscleGroups: true,
      primaryMuscle: true,
      equipment: true,
      difficulty: true,
      isCustom: true,
    },
  });

  return NextResponse.json(exercise, { status: 201 });
}
