/**
 * Chi può usare il Coach. Per ora solo gli utenti in COACH_FREE_USER_IDS
 * (id separati da virgole, impostati su Vercel): l'abbonamento a pagamento
 * si aggiungerà qui, senza toccare chi chiama questa funzione.
 *
 * Si usa l'id utente e non l'email perché la registrazione non verifica
 * l'indirizzo: un id non si può "prendere" registrandosi.
 */

export function parseUserIdList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function hasCoachAccess(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return parseUserIdList(process.env.COACH_FREE_USER_IDS).has(userId);
}

/** Il Coach funziona solo se il server ha la chiave dell'API */
export const isCoachConfigured = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);
