import Anthropic from "@anthropic-ai/sdk";

/**
 * Configurazione del modello del Coach. La chiave è solo lato server
 * (ANTHROPIC_API_KEY su Vercel); il client si crea alla prima richiesta.
 */

export const COACH_MODEL = "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

/** Su Opus 5.5 il default è "medium": lo si imposta comunque in modo esplicito */
export function coachEffort(): Effort {
  const value = process.env.COACH_EFFORT as Effort | undefined;
  return value && EFFORTS.includes(value) ? value : "medium";
}

/**
 * - server-side-fallback: se un controllo di sicurezza rifiuta per errore,
 *   la richiesta riparte su un modello di riserva nella stessa chiamata.
 * - mid-conversation-system-clear-at: il contesto di ogni turno (data, piano
 *   attivo) resta nella conversazione ma il modello lo vede solo in quel turno.
 */
export const COACH_BETAS = ["server-side-fallback-2026-07-01", "mid-conversation-system-clear-at-2026-08-21"];

/** Massimo di token per risposta e di passaggi (tool) per turno */
export const MAX_OUTPUT_TOKENS = 32_000;
export const MAX_TOOL_ROUNDS = 10;

/** Messaggi al giorno per utente: protegge dai costi imprevisti */
export function dailyMessageLimit(): number {
  const value = Number(process.env.COACH_DAILY_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : 150;
}

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2 });
  return client;
}
