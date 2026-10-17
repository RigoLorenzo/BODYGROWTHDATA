export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionDraftSchema } from "@/lib/session-draft";

interface Params { params: Promise<{ sessionId: string }> }

const MAX_BYTES = 256 * 1024;

/**
 * Salva la bozza dell'allenamento in corso. POST (non PUT) così il browser
 * può inviarla anche mentre la pagina si chiude (fetch keepalive).
 */
export async function POST(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Bozza troppo grande" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const parsed = sessionDraftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Bozza non valida" }, { status: 400 });

  // Solo l'allenamento aperto dell'utente: quelli chiusi non si riscrivono
  const { count } = await prisma.workoutSession.updateMany({
    where: { id: sessionId, userId: session.user.id, status: "ACTIVE" },
    data: { draft: parsed.data },
  });
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
