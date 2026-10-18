export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveRun } from "@/lib/run/repository";

const LIST_FIELDS = {
  id: true,
  name: true,
  source: true,
  sportType: true,
  startedAt: true,
  distance: true,
  movingTime: true,
  elevationGain: true,
  avgHeartRate: true,
  polyline: true,
  trainingLoad: true,
} as const;

export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 50)));
  const runs = await prisma.runActivity.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: LIST_FIELDS,
  });
  return NextResponse.json(runs);
}

const manualSchema = z.object({
  name: z.string().trim().max(200).optional(),
  startedAt: z.coerce.date(),
  distanceKm: z.number().positive().max(500),
  durationSeconds: z.number().int().positive().max(7 * 86_400),
  elevationGain: z.number().min(0).max(20_000).nullish(),
  avgHeartRate: z.number().min(30).max(250).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

/** Corsa inserita a mano */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = manualSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  if (d.startedAt.getTime() > Date.now() + 3_600_000) {
    return NextResponse.json({ error: "La data è nel futuro" }, { status: 400 });
  }
  const run = await saveRun(session.user.id, {
    source: "MANUAL",
    name: d.name || "Corsa",
    startedAt: d.startedAt,
    distance: Math.round(d.distanceKm * 1000),
    movingTime: d.durationSeconds,
    elapsedTime: d.durationSeconds,
    elevationGain: d.elevationGain ?? null,
    avgHeartRate: d.avgHeartRate ?? null,
    notes: d.notes ?? null,
  });
  return NextResponse.json({ id: run.id }, { status: 201 });
}
