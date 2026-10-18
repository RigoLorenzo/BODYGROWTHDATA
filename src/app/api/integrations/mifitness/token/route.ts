export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { MiFitnessError } from "@/lib/mifitness/client";
import { connectMiFitness, syncMiFitness } from "@/lib/mifitness/sync";

const schema = z.object({
  userId: z.string().trim().regex(/^\d{1,20}$/, "userId non valido"),
  passToken: z.string().trim().min(10).max(2000),
});

/** Collegamento manuale con userId e passToken (alternativa al QR) */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  try {
    await connectMiFitness(session.user.id, parsed.data.userId, parsed.data.passToken);
  } catch (error) {
    const status = error instanceof MiFitnessError && error.auth ? 401 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Collegamento non riuscito" }, { status });
  }
  const imported = await syncMiFitness(session.user.id).catch(() => null);
  return NextResponse.json({ connected: true, imported });
}
