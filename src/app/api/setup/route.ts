export const runtime = "nodejs";

// Alias for /api/setup-db — seeds exercises and achievements.
// Migrations run at build time via scripts/migrate.mjs (execSync unavailable in serverless).
// POST with header: x-setup-secret: <SETUP_SECRET env var>, oppure da utente autenticato
// (pulsante "Aggiorna libreria esercizi" nelle impostazioni).
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: Request) {
  const secret = req.headers.get("x-setup-secret");
  const hasSecret = !!secret && secret === process.env.SETUP_SECRET;

  if (!hasSecret) {
    const session = await auth().catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedDatabase();
    return NextResponse.json({
      success: true,
      exercises: result.exercises,
      achievements: result.achievements,
      message: `Libreria aggiornata: ${result.exercises} esercizi e ${result.achievements} obiettivi`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
