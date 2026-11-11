/**
 * Costo stimato delle risposte del Coach dai token registrati in
 * CoachMessage.usage. Prezzi di Claude Sonnet 5.5 in dollari per milione di token.
 */
export const SONNET_PRICES = {
  input: 2,
  output: 10,
  cacheRead: 0.1,
  cacheWrite: 2.5,
} as const;

interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

const tokens = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

export function estimateCostUsd(usage: unknown): number {
  if (!usage || typeof usage !== "object") return 0;
  const u = usage as UsageLike;
  return (
    (tokens(u.input_tokens) * SONNET_PRICES.input +
      tokens(u.output_tokens) * SONNET_PRICES.output +
      tokens(u.cache_read_input_tokens) * SONNET_PRICES.cacheRead +
      tokens(u.cache_creation_input_tokens) * SONNET_PRICES.cacheWrite) /
    1_000_000
  );
}

export const roundCost = (usd: number) => Math.round(usd * 100) / 100;
