export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasCoachAccess, isCoachConfigured } from "@/lib/coach/access";

/** Il Coach è disponibile per questo utente? (mostra o nasconde la voce di menu) */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    { access: hasCoachAccess(session.user.id), configured: isCoachConfigured() },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
