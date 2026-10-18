export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MiFitnessError } from "@/lib/mifitness/client";
import { syncMiFitness } from "@/lib/mifitness/sync";

/** Sotto questo intervallo la sincronizzazione automatica non riparte */
const MIN_INTERVAL_MS = 5 * 60_000;

/** Sincronizza; `?auto=1` (all'apertura dell'app) rispetta l'intervallo minimo */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const conn = await prisma.miFitnessConnection.findUnique({
    where: { userId },
    select: { lastSyncAt: true, lastError: true },
  });
  const auto = new URL(req.url).searchParams.get("auto") === "1";
  // La sincronizzazione automatica parte a ogni apertura: senza collegamento non è un errore
  if (!conn) {
    return auto
      ? NextResponse.json({ skipped: true, imported: 0, wellness: 0 })
      : NextResponse.json({ error: "Mi Fitness non collegato" }, { status: 404 });
  }

  const recent = conn.lastSyncAt && Date.now() - conn.lastSyncAt.getTime() < MIN_INTERVAL_MS;
  if (auto && (recent || conn.lastError)) return NextResponse.json({ skipped: true, imported: 0, wellness: 0 });

  try {
    const { imported, wellness } = await syncMiFitness(userId);
    return NextResponse.json({ imported, wellness });
  } catch (error) {
    const reconnect = error instanceof MiFitnessError && error.auth;
    console.error("sync Mi Fitness", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore Mi Fitness", reconnect },
      { status: reconnect ? 401 : 502 }
    );
  }
}
