export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { signedInUser } from "@/lib/coach/guard";
import { joinWaitlist, leaveWaitlist } from "@/lib/coach/invites";

const bodySchema = z.object({ note: z.string().trim().max(500).nullish() });

/** Entra nella lista d'attesa del Coach (con una nota facoltativa) */
export async function POST(req: Request) {
  const guard = await signedInUser();
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Nota non valida" }, { status: 400 });
  await joinWaitlist(guard.userId, parsed.data.note || null);
  return NextResponse.json({ waitlisted: true });
}

export async function DELETE() {
  const guard = await signedInUser();
  if ("response" in guard) return guard.response;
  await leaveWaitlist(guard.userId);
  return NextResponse.json({ waitlisted: false });
}
