import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
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
        muscle ? { muscleGroups: { has: muscle as any } } : {},
        equipment ? { equipment: { has: equipment as any } } : {},
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
