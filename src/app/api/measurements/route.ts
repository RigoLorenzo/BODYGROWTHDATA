import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const measurementSchema = z.object({
  date: z.string().optional(),
  weight: z.number().optional(),
  bodyFat: z.number().optional(),
  muscleMass: z.number().optional(),
  chest: z.number().optional(),
  arms: z.number().optional(),
  waist: z.number().optional(),
  hips: z.number().optional(),
  thighs: z.number().optional(),
  calves: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const measurements = await prisma.bodyMeasurement.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json(measurements);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = measurementSchema.parse(body);

  const measurement = await prisma.bodyMeasurement.create({
    data: {
      userId: session.user.id,
      date: data.date ? new Date(data.date) : new Date(),
      ...data,
    },
  });

  return NextResponse.json(measurement, { status: 201 });
}
