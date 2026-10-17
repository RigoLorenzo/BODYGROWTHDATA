export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { programInputSchema } from "@/lib/program-schema";
import { assertExercisesUsable, createProgram, InvalidExercisesError } from "@/lib/program-writer";

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const programs = await prisma.program.findMany({
    where: { creatorId: session.user.id },
    include: {
      days: { orderBy: { dayIndex: "asc" } },
      activations: { where: { userId: session.user.id }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(programs);
}

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = programInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const program = await prisma.$transaction(async (tx) => {
      await assertExercisesUsable(tx, session.user.id, parsed.data);
      return createProgram(tx, session.user.id, parsed.data);
    });
    return NextResponse.json(program, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidExercisesError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
