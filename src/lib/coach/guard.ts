import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasCoachAccess } from "./access";

/**
 * Controllo comune alle API del Coach: utente loggato e con accesso.
 * Restituisce l'id utente oppure la risposta di errore da inviare.
 */
export async function coachUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!hasCoachAccess(session.user.id)) {
    return { response: NextResponse.json({ error: "Il Coach non è attivo per questo account." }, { status: 402 }) };
  }
  return { userId: session.user.id };
}
