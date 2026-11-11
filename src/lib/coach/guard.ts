import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { coachLevel, isCoachAdmin } from "./access";

/**
 * Controlli comuni alle API del Coach. Restituiscono l'utente oppure la
 * risposta di errore da inviare.
 */
export async function coachUser(): Promise<{ userId: string; level: "owner" | "tester" } | { response: NextResponse }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const level = await coachLevel(session.user.id);
  if (level === "none") {
    return { response: NextResponse.json({ error: "Il Coach non è attivo per questo account." }, { status: 402 }) };
  }
  return { userId: session.user.id, level };
}

/** Solo per le API di gestione (inviti, lista d'attesa, tester) */
export async function coachAdmin(): Promise<{ userId: string } | { response: NextResponse }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isCoachAdmin(session.user.id)) return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: session.user.id };
}

/** Utente loggato, con o senza accesso al Coach (lista d'attesa, inviti) */
export async function signedInUser(): Promise<{ userId: string } | { response: NextResponse }> {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userId: session.user.id };
}
