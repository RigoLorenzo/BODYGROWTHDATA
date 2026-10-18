export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MAX_HR, DEFAULT_RESTING_HR, trimp } from "@/lib/run/load";

const schema = z
  .object({
    maxHeartRate: z.number().int().min(120).max(230).nullable(),
    restingHeartRate: z.number().int().min(30).max(110).nullable(),
    weeklyRunKmGoal: z.number().min(0).max(300).nullable(),
  })
  .refine((d) => !d.maxHeartRate || !d.restingHeartRate || d.maxHeartRate > d.restingHeartRate, {
    message: "La FC massima deve superare quella a riposo",
  });

/** FC massima/a riposo (per il carico) e obiettivo km settimanale */
export async function PUT(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  const userId = session.user.id;
  const data = parsed.data;

  await prisma.profile.upsert({ where: { userId }, update: data, create: { userId, ...data } });

  // Il carico dipende dalle frequenze: si ricalcola su tutte le corse
  const max = data.maxHeartRate ?? DEFAULT_MAX_HR;
  const resting = data.restingHeartRate ?? DEFAULT_RESTING_HR;
  const runs = await prisma.runActivity.findMany({ where: { userId }, select: { id: true, movingTime: true, avgHeartRate: true } });
  await prisma.$transaction(
    runs.map((r) =>
      prisma.runActivity.update({ where: { id: r.id }, data: { trainingLoad: trimp(r.movingTime, r.avgHeartRate, max, resting) } })
    )
  );
  return NextResponse.json({ success: true, recalculated: runs.length });
}
