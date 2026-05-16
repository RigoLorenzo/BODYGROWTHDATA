export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MuscleGroup, Equipment } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
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
        query ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { aliases: { hasSome: [query] } },
            { tags: { hasSome: [query] } },
          ],
        } : {},
        muscle ? { muscleGroups: { has: muscle as MuscleGroup } } : {},
        equipment ? { equipment: { has: equipment as Equipment } } : {},
      ],
    },
    orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    take: 50,
    select: {
      id: true,
      name: true,
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
