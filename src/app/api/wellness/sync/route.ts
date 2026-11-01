export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEVICES } from "@/lib/devices/registry";
import { wellnessSourceState } from "@/lib/devices/source";

/** Accesso all'orologio e margine di chiusura restano sotto il limite di 60 s */
const BUDGET_MS = 40_000;

/**
 * Un passo dello storico benessere dell'orologio scelto come fonte: la
 * pagina Benessere la richiama finché `progress.complete` non è vero. Ogni
 * passo salva blocchi completi.
 */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { active } = await wellnessSourceState(userId);
  if (!active) return NextResponse.json({ error: "Nessuno smartwatch collegato" }, { status: 404 });
  const device = DEVICES[active];
  const before = await device.wellness(userId);
  if (before?.lastError) return NextResponse.json({ error: before.lastError, reconnect: true }, { status: 401 });

  try {
    const saved = await device.syncWellnessHistory(userId, BUDGET_MS);
    const state = await device.wellness(userId);
    return NextResponse.json({ saved, progress: state?.progress ?? null, source: active });
  } catch (error) {
    const reconnect = device.isAuthError(error);
    console.error(`storico benessere ${device.label}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Errore ${device.label}`, reconnect },
      { status: reconnect ? 401 : 502 }
    );
  }
}
