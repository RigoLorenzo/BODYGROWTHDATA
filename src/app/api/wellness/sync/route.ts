export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MiFitnessError } from "@/lib/mifitness/client";
import { syncWellnessOnly } from "@/lib/mifitness/sync";
import { wellnessProgress } from "@/lib/mifitness/wellness-plan";
import { firstWellnessDay } from "@/lib/mifitness/wellness-sync";

/** Login Xiaomi e margine di chiusura restano sotto il limite di 60 s */
const BUDGET_MS = 40_000;

/**
 * Un passo dello storico benessere: la pagina Benessere la richiama finché
 * `progress.complete` non è vero. Ogni passo salva blocchi completi.
 */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const conn = await prisma.miFitnessConnection.findUnique({ where: { userId }, select: { lastError: true } });
  if (!conn) return NextResponse.json({ error: "Mi Fitness non collegato" }, { status: 404 });
  if (conn.lastError) return NextResponse.json({ error: conn.lastError, reconnect: true }, { status: 401 });

  try {
    const saved = await syncWellnessOnly(userId, BUDGET_MS);
    const state = await prisma.miFitnessConnection.findUniqueOrThrow({
      where: { userId },
      select: { wellnessSyncedFrom: true, wellnessHrFrom: true },
    });
    return NextResponse.json({ saved, progress: wellnessProgress(state, await firstWellnessDay(userId)) });
  } catch (error) {
    const reconnect = error instanceof MiFitnessError && error.auth;
    console.error("storico benessere", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore Mi Fitness", reconnect },
      { status: reconnect ? 401 : 502 }
    );
  }
}
