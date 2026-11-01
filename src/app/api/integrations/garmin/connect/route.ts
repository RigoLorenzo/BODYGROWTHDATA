export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { GarminError } from "@/lib/garmin/client";
import { connectGarmin, syncGarmin } from "@/lib/garmin/sync";

/** La chiave personale Garmin: un unico testo, senza spazi né a capo */
const schema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(16, "Chiave Garmin troppo corta")
    .max(4000, "Chiave Garmin troppo lunga")
    .regex(/^[\x21-\x7e]+$/, "La chiave contiene caratteri non validi"),
});

/** Collega Garmin con la chiave della Personal API e importa subito le corse */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });
  }
  try {
    await connectGarmin(session.user.id, parsed.data.apiKey);
  } catch (error) {
    const status = error instanceof GarminError && error.auth ? 401 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Collegamento non riuscito" }, { status });
  }
  // Al collegamento poco benessere: il resto arriva con le sincronizzazioni successive
  const imported = await syncGarmin(session.user.id, { wellnessBudgetMs: 8_000, limitMs: 30_000 })
    .then((r) => r.imported)
    .catch(() => null);
  return NextResponse.json({ connected: true, imported });
}
