/**
 * Regole di accesso al Coach (funzioni pure, senza database).
 * - owner: gli id in COACH_FREE_USER_IDS (variabile su Vercel), cioè il proprietario;
 * - tester: chi ha ricevuto l'accesso (invito o lista d'attesa), salvato in CoachAccess;
 * - none: tutti gli altri vedono la lista d'attesa.
 * Si usa l'id utente e non l'email perché la registrazione non verifica l'indirizzo.
 */

export type CoachLevel = "owner" | "tester" | "none";

export function parseUserIdList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export const isCoachOwner = (userId: string | undefined | null): boolean =>
  Boolean(userId) && parseUserIdList(process.env.COACH_FREE_USER_IDS).has(userId!);

/** Chi gestisce inviti e lista d'attesa: COACH_ADMIN_USER_IDS, altrimenti il proprietario */
export function isCoachAdmin(userId: string | undefined | null): boolean {
  if (!userId) return false;
  const admins = parseUserIdList(process.env.COACH_ADMIN_USER_IDS);
  return admins.size > 0 ? admins.has(userId) : isCoachOwner(userId);
}

/** Decisione pura, dati già caricati */
export function levelFrom(userId: string | null | undefined, access: { revokedAt: Date | null } | null): CoachLevel {
  if (!userId) return "none";
  if (isCoachOwner(userId)) return "owner";
  return access && !access.revokedAt ? "tester" : "none";
}

/** Il Coach funziona solo se il server ha la chiave dell'API */
export const isCoachConfigured = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);
