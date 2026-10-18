export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { disconnectMiFitness } from "@/lib/mifitness/sync";

/** Stato del collegamento (il token non esce mai dal server) */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connection = await prisma.miFitnessConnection.findUnique({
    where: { userId: session.user.id },
    select: { xiaomiId: true, region: true, lastSyncAt: true, lastError: true, createdAt: true },
  });
  return NextResponse.json({ connection });
}

/** Scollega: cancella il token (le corse importate restano) */
export async function DELETE() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectMiFitness(session.user.id);
  return NextResponse.json({ success: true });
}
