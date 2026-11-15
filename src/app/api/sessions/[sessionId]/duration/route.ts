export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { durationCheck, repairSessionDuration } from "@/lib/session-duration-server";

interface Params {
  params: Promise<{ sessionId: string }>;
}

/** La durata della seduta è anomala? Con la stima dallo storico dell'utente */
export async function GET(_req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const check = await durationCheck(session.user.id, sessionId);
  if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(check, { headers: { "Cache-Control": "no-store" } });
}

/** Corregge la durata anomala con la stima (solo sedute dell'utente, solo se oltre 4 ore) */
export async function POST(_req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const repaired = await repairSessionDuration(session.user.id, sessionId);
  if (!repaired) return NextResponse.json({ error: "Durata non anomala" }, { status: 409 });
  return NextResponse.json(repaired);
}
