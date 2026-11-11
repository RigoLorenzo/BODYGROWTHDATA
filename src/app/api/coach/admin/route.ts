export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { coachAdmin } from "@/lib/coach/guard";
import { adminOverview, createInvite, grantAccess, revokeAccess, setInviteDisabled } from "@/lib/coach/invites";
import { normalizeInviteCode } from "@/lib/coach/invite-code";

/** Gestione del Coach: lista d'attesa, tester, inviti e costi (solo admin) */
export async function GET() {
  const guard = await coachAdmin();
  if ("response" in guard) return guard.response;
  return NextResponse.json(await adminOverview(), { headers: { "Cache-Control": "no-store" } });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), userId: z.string().min(1) }),
  z.object({ action: z.literal("revoke"), userId: z.string().min(1) }),
  z.object({
    action: z.literal("create_invite"),
    label: z.string().trim().min(1).max(60),
    maxUses: z.number().int().min(1).max(100),
    expiresInDays: z.number().int().min(1).max(90).nullable(),
  }),
  z.object({ action: z.literal("set_invite_disabled"), code: z.string(), disabled: z.boolean() }),
]);

export async function POST(req: Request) {
  const guard = await coachAdmin();
  if ("response" in guard) return guard.response;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  const input = parsed.data;

  switch (input.action) {
    case "grant":
      return (await grantAccess(input.userId))
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    case "revoke":
      return (await revokeAccess(input.userId))
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Nessun accesso attivo" }, { status: 404 });
    case "create_invite": {
      const invite = await createInvite(input);
      return NextResponse.json({ code: invite.code });
    }
    case "set_invite_disabled": {
      const code = normalizeInviteCode(input.code);
      return code && (await setInviteDisabled(code, input.disabled))
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Codice non trovato" }, { status: 404 });
    }
  }
}
