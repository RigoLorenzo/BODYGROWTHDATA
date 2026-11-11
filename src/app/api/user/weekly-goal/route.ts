export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { weeklyGoalSummary } from "@/lib/weekly-goal-server";

/** Obiettivo settimanale: avanzamento, valori scelti e suggerimento */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await weeklyGoalSummary(session.user.id), { headers: { "Cache-Control": "no-store" } });
}

const schema = z.object({
  /** null: si usa la frequenza del piano attivo */
  sessions: z.number().int().min(1).max(14).nullable(),
  /** null o 0: nessun obiettivo di km (stesso campo e stessi limiti delle impostazioni Corsa) */
  km: z.number().min(0).max(300).nullable(),
});

export async function PUT(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Valori non validi" }, { status: 400 });
  const data = { weeklySessionsGoal: parsed.data.sessions, weeklyRunKmGoal: parsed.data.km };
  const userId = session.user.id;
  await prisma.profile.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  return NextResponse.json(await weeklyGoalSummary(userId));
}
