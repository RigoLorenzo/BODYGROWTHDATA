export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const programExerciseSchema = z.object({
  exerciseId: z.string(),
  orderIndex: z.number().default(0),
  sets: z.number().min(1).max(20).default(3),
  repsMin: z.number().min(1).max(100).default(8),
  repsMax: z.number().min(1).max(100).default(12),
  rpe: z.number().min(1).max(10).optional(),
  restSeconds: z.number().min(0).max(600).default(90),
  notes: z.string().optional(),
});

const programDaySchema = z.object({
  dayIndex: z.number(),
  name: z.string().min(1).max(100),
  workoutType: z.enum(["PUSH", "PULL", "LEGS", "UPPER", "LOWER", "FULL_BODY", "CARDIO", "CUSTOM"]).default("CUSTOM"),
  exercises: z.array(programExerciseSchema).default([]),
});

const createProgramSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  frequency: z.number().min(1).max(7).default(3),
  durationWeeks: z.number().min(1).max(52).default(8),
  splitType: z.enum(["PPL", "UPPER_LOWER", "BRO_SPLIT", "FULL_BODY", "ARNOLD", "CUSTOM"]).default("CUSTOM"),
  days: z.array(programDaySchema).default([]),
});

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

  const body = await req.json();
  const data = createProgramSchema.parse(body);

  const program = await prisma.program.create({
    data: {
      name: data.name,
      description: data.description,
      frequency: data.frequency,
      durationWeeks: data.durationWeeks,
      splitType: data.splitType,
      creatorId: session.user.id,
      days: {
        create: data.days.map((day) => ({
          dayIndex: day.dayIndex,
          name: day.name,
          workoutType: day.workoutType,
          exercises: {
            create: day.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              orderIndex: ex.orderIndex,
              sets: ex.sets,
              repsMin: ex.repsMin,
              repsMax: ex.repsMax,
              rpe: ex.rpe,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
            })),
          },
        })),
      },
    },
    include: {
      days: {
        include: { exercises: true },
        orderBy: { dayIndex: "asc" },
      },
    },
  });

  return NextResponse.json(program, { status: 201 });
}
