export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { disconnectStrava, StravaError, stravaConfig, syncActivities } from "@/lib/strava";

/** Stato del collegamento (senza mai esporre i token) */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conn = await prisma.stravaConnection.findUnique({
    where: { userId: session.user.id },
    select: { athleteId: true, athleteName: true, lastSyncAt: true, createdAt: true },
  });
  return NextResponse.json({ configured: !!stravaConfig(), connection: conn });
}

/** Sincronizza a mano: le corse dall'ultima sincronizzazione (con margine) */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conn = await prisma.stravaConnection.findUnique({ where: { userId: session.user.id }, select: { lastSyncAt: true } });
  if (!conn) return NextResponse.json({ error: "Strava non collegato" }, { status: 404 });
  try {
    const since = conn.lastSyncAt ? new Date(conn.lastSyncAt.getTime() - 3 * 86_400_000) : undefined;
    const imported = await syncActivities(session.user.id, { since, maxPages: since ? 2 : 5 });
    return NextResponse.json({ imported });
  } catch (error) {
    const status = error instanceof StravaError && error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore Strava" }, { status });
  }
}

/** Scollega Strava (le corse importate restano) */
export async function DELETE() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectStrava(session.user.id);
  return NextResponse.json({ success: true });
}
