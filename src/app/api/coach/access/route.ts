export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { coachLevel, isCoachAdmin, isCoachConfigured } from "@/lib/coach/access";
import { waitlistEntry } from "@/lib/coach/invites";

/** Stato del Coach per questo utente: accesso, lista d'attesa, gestione */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [level, waitlist] = await Promise.all([coachLevel(session.user.id), waitlistEntry(session.user.id)]);
  return NextResponse.json(
    {
      access: level !== "none",
      level,
      admin: isCoachAdmin(session.user.id),
      waitlisted: Boolean(waitlist),
      configured: isCoachConfigured(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
