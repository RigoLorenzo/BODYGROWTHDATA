export const runtime = "nodejs";
export const maxDuration = 300;
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMiFitness } from "@/lib/mifitness/sync";

/** Vercel Cron invia "Authorization: Bearer $CRON_SECRET" */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Aggiornamento giornaliero anche per chi non apre l'app */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connections = await prisma.miFitnessConnection.findMany({
    where: { lastError: null },
    select: { userId: true },
  });
  let synced = 0;
  for (const { userId } of connections) {
    try {
      await syncMiFitness(userId);
      synced++;
    } catch (error) {
      console.error("cron Mi Fitness", userId, error);
    }
  }
  return NextResponse.json({ connections: connections.length, synced });
}
