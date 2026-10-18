export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteRun } from "@/lib/run/repository";
import { importActivity } from "@/lib/strava";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let run = await prisma.runActivity.findFirst({ where: { id, userId: session.user.id } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Corse Strava importate dall'elenco: split e migliori tempi si leggono ora
  if (run.source === "STRAVA" && !run.detailed && run.externalId) {
    try {
      const updated = await importActivity(session.user.id, run.externalId, { updateStreak: false });
      if (updated) run = updated;
    } catch (error) {
      console.warn("dettaglio Strava non disponibile", error);
    }
  }
  return NextResponse.json(run);
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullish(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const { count } = await prisma.runActivity.updateMany({ where: { id, userId: session.user.id }, data: parsed.data });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ok = await deleteRun(session.user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
