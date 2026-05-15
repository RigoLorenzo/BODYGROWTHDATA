import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSetSchema = z.object({
  workoutExerciseId: z.string(),
  setNumber: z.number(),
  type: z.enum(["WARMUP", "WORKING", "DROPSET", "FAILURE", "MYOREP", "FEEDER"]).optional(),
  reps: z.number().optional(),
  weight: z.number().optional(),
  rpe: z.number().min(1).max(10).optional(),
  tempo: z.string().optional(),
  notes: z.string().optional(),
});

interface Params { params: Promise<{ sessionId: string }> }

export async function POST(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = addSetSchema.parse(body);

  const volume = (data.weight ?? 0) * (data.reps ?? 0);

  const set = await prisma.set.create({
    data: {
      workoutExerciseId: data.workoutExerciseId,
      setNumber: data.setNumber,
      type: data.type ?? "WORKING",
      reps: data.reps,
      weight: data.weight,
      rpe: data.rpe,
      tempo: data.tempo,
      notes: data.notes,
      volume,
    },
  });

  // Update session totals
  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      totalVolume: { increment: volume },
      totalSets: { increment: data.type !== "WARMUP" ? 1 : 0 },
      totalReps: { increment: data.reps ?? 0 },
    },
  });

  return NextResponse.json(set, { status: 201 });
}
