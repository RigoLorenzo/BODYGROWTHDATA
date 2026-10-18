export const runtime = "nodejs";
export const maxDuration = 60;
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteRun } from "@/lib/run/repository";
import { importActivity, StravaError } from "@/lib/strava";

/** Verifica dell'iscrizione: Strava chiede di rimandare indietro la challenge */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (params.get("hub.mode") === "subscribe" && expected && params.get("hub.verify_token") === expected) {
    return NextResponse.json({ "hub.challenge": params.get("hub.challenge") });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

interface StravaEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  updates?: Record<string, string>;
}

/**
 * Strava non firma gli eventi: non ci si fida del contenuto. Si usa solo per
 * sapere *cosa* rileggere, e ogni modifica viene verificata sull'API con il
 * token dell'atleta (un evento falso non può cancellare né inventare corse).
 */
async function handle(event: StravaEvent) {
  const conn = await prisma.stravaConnection.findUnique({
    where: { athleteId: String(event.owner_id) },
    select: { userId: true },
  });
  if (!conn) return;
  const { userId } = conn;

  if (event.object_type === "athlete") {
    if (event.updates?.authorized === "false") {
      // Revoca vera solo se il token non funziona più
      try {
        await importActivity(userId, "0");
      } catch (error) {
        if (error instanceof StravaError && (error.status === 401 || error.status === 400)) {
          await prisma.stravaConnection.delete({ where: { userId } });
        }
      }
    }
    return;
  }

  const activityId = String(event.object_id);
  if (event.aspect_type === "delete") {
    try {
      await importActivity(userId, activityId);
      return; // Esiste ancora: evento non attendibile
    } catch (error) {
      if (!(error instanceof StravaError && error.status === 404)) throw error;
    }
    const run = await prisma.runActivity.findUnique({
      where: { userId_source_externalId: { userId, source: "STRAVA", externalId: activityId } },
      select: { id: true },
    });
    if (run) await deleteRun(userId, run.id);
    return;
  }

  // create / update (anche un cambio di tipo, es. da Camminata a Corsa)
  const saved = await importActivity(userId, activityId);
  if (!saved && event.aspect_type === "update") {
    // Non è più una corsa: la togliamo
    const run = await prisma.runActivity.findUnique({
      where: { userId_source_externalId: { userId, source: "STRAVA", externalId: activityId } },
      select: { id: true },
    });
    if (run) await deleteRun(userId, run.id);
  }
}

export async function POST(req: Request) {
  const event = (await req.json().catch(() => null)) as StravaEvent | null;
  if (!event?.object_type || !event.owner_id) return NextResponse.json({ ok: true });

  // Strava vuole una risposta entro 2 secondi: il lavoro continua dopo
  after(async () => {
    try {
      await handle(event);
    } catch (error) {
      console.error("strava webhook", event.object_type, event.aspect_type, error);
    }
  });
  return NextResponse.json({ ok: true });
}
