export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { ensureWebhookSubscription } from "@/lib/strava";

/** Attiva gli aggiornamenti automatici (webhook Strava), una volta sola */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // L'iscrizione è unica per l'app: la gestisce solo chi ha Strava collegato
  const conn = await prisma.stravaConnection.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!conn) return NextResponse.json({ error: "Collega prima Strava" }, { status: 403 });
  try {
    const result = await ensureWebhookSubscription(`${appUrl(req)}/api/integrations/strava/webhook`);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore" }, { status: 502 });
  }
}
