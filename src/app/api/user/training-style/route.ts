export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRAINING_STYLES } from "@/lib/training-style";

const bodySchema = z.object({ style: z.enum(TRAINING_STYLES) });

/** Stile di allenamento dell'utente collegato (null: non ancora scelto) */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { trainingStyle: true } });
  return NextResponse.json({ style: user?.trainingStyle ?? null });
}

/** Sceglie o cambia lo stile: si può fare quando si vuole, i dati restano tutti */
export async function PATCH(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Stile non valido" }, { status: 400 });
  await prisma.user.update({ where: { id: session.user.id }, data: { trainingStyle: parsed.data.style } });
  return NextResponse.json({ style: parsed.data.style });
}
