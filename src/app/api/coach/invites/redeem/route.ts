export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { signedInUser } from "@/lib/coach/guard";
import { redeemInvite } from "@/lib/coach/invites";

const bodySchema = z.object({ code: z.string().max(40) });

/** Usa un codice d'invito: l'utente riceve l'accesso al Coach */
export async function POST(req: Request) {
  const guard = await signedInUser();
  if ("response" in guard) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Codice non valido" }, { status: 400 });

  const result = await redeemInvite(guard.userId, parsed.data.code);
  if (result === "invalid") {
    return NextResponse.json({ error: "Codice non valido, scaduto o già usato." }, { status: 404 });
  }
  return NextResponse.json({ status: result });
}
