import { randomInt } from "crypto";

/**
 * Codici d'invito al Coach: 8 caratteri senza simboli che si confondono
 * (niente 0/O, 1/I/L). 32^8 ≈ mille miliardi di combinazioni: non si indovinano.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;
const PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

export function generateInviteCode(): string {
  return Array.from({ length: LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** Accetta minuscole, spazi e trattini ("abcd-efgh"); null se non è un codice valido */
export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  return PATTERN.test(code) ? code : null;
}

export const invitePath = (code: string) => `/invito/${code}`;
