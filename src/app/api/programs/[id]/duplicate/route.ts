export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProgram } from "@/lib/program-writer";
import type { ProgramInput } from "@/lib/program-schema";

interface Params { params: Promise<{ id: string }> }

const copyName = (name: string) => {
  const suffix = " (copia)";
  return name.slice(0, 100 - suffix.length) + suffix;
};

/** Crea una copia indipendente del piano (non attiva), da modificare liberamente */
export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const source = await prisma.program.findFirst({
    where: { id, creatorId: session.user.id },
    include: {
      days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { orderIndex: "asc" } } } },
    },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input: ProgramInput = {
    name: copyName(source.name),
    description: source.description,
    frequency: source.frequency,
    durationWeeks: source.durationWeeks,
    splitType: source.splitType,
    days: source.days.map((day) => ({
      name: day.name,
      workoutType: day.workoutType,
      exercises: day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        rpe: ex.rpe,
        restSeconds: ex.restSeconds,
        notes: ex.notes,
      })),
    })),
  };

  const copy = await prisma.$transaction((tx) => createProgram(tx, session.user.id, input));
  return NextResponse.json({ id: copy.id, name: copy.name }, { status: 201 });
}
