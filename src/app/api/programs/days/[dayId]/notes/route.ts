export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NOTE_MAX, cleanNote } from "@/lib/exercise-notes";

interface Params {
  params: Promise<{ dayId: string }>;
}

const bodySchema = z.object({
  exerciseId: z.string().min(1).max(60),
  notes: z.string().max(NOTE_MAX * 2).nullable(),
});

/**
 * Nota di un esercizio nel giorno del piano, scritta durante l'allenamento:
 * resta per le prossime sedute di quel giorno finché non la cambi.
 * `saved: false` se l'esercizio non è nel giorno (aggiunto o sostituito).
 */
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });

  const { dayId } = await params;
  const { count } = await prisma.programExercise.updateMany({
    where: { dayId, exerciseId: parsed.data.exerciseId, day: { program: { creatorId: session.user.id } } },
    data: { notes: cleanNote(parsed.data.notes) },
  });
  return NextResponse.json({ saved: count > 0 });
}
