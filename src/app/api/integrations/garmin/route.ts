export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEVICES } from "@/lib/devices/registry";

/** Stato del collegamento (chiave e token non escono mai dal server) */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ connection: await DEVICES.GARMIN.status(session.user.id) });
}

/** Scollega: cancella chiave e token (corse e dati benessere restano) */
export async function DELETE() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await DEVICES.GARMIN.disconnect(session.user.id);
  return NextResponse.json({ success: true });
}
