/**
 * Token-cost estimation for Anthropic Claude models.
 *
 * Prices are USD per million tokens, sourced from
 * https://docs.anthropic.com/claude/docs/models-overview
 * and converted to micro-cents (1¢ = 1_000_000 µ¢) so all arithmetic is integer-safe.
 *
 * Cache rates apply when prompt-cache `cache_control` blocks are used:
 *   - cache_write: 25% premium over base input rate
 *   - cache_read:  90% discount on base input rate
 */

export interface ModelPricing {
  /** Cost per million input tokens, in micro-cents (¢ × 10^-6). */
  readonly inputPerMillion: number;
  /** Cost per million output tokens, in micro-cents. */
  readonly outputPerMillion: number;
  /** Cost per million tokens for cache-write input, in micro-cents. */
  readonly cacheWritePerMillion: number;
  /** Cost per million tokens for cache-read input, in micro-cents. */
  readonly cacheReadPerMillion: number;
}

/**
 * Pricing as of Q1 2026. Update when Anthropic publishes new rates.
 * Values are micro-cents-per-million-tokens (so $1.00/M = 100_000_000 µ¢/M).
 */
export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  "claude-haiku-4-5": {
    inputPerMillion: 100_000_000,
    outputPerMillion: 500_000_000,
    cacheWritePerMillion: 125_000_000,
    cacheReadPerMillion: 10_000_000,
  },
  "claude-sonnet-4-6": {
    inputPerMillion: 300_000_000,
    outputPerMillion: 1_500_000_000,
    cacheWritePerMillion: 375_000_000,
    cacheReadPerMillion: 30_000_000,
  },
  "claude-opus-4-7": {
    inputPerMillion: 1_500_000_000,
    outputPerMillion: 7_500_000_000,
    cacheWritePerMillion: 1_875_000_000,
    cacheReadPerMillion: 150_000_000,
  },
};

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
}

/**
 * Compute the cost of a single LLM call in micro-cents. Returns 0 for unknown
 * models rather than throwing — pricing changes shouldn't break callers.
 *
 * Use {@link microCentsToCents} or {@link microCentsToDollars} to format.
 */
export function estimateCostMicroCents(usage: TokenUsage, model: string): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const cacheWrite = usage.cacheCreationInputTokens ?? 0;
  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const freshInput = Math.max(0, usage.inputTokens - cacheWrite - cacheRead);

  return (
    (freshInput * pricing.inputPerMillion) / 1_000_000 +
    (cacheWrite * pricing.cacheWritePerMillion) / 1_000_000 +
    (cacheRead * pricing.cacheReadPerMillion) / 1_000_000 +
    (usage.outputTokens * pricing.outputPerMillion) / 1_000_000
  );
}

export const microCentsToCents = (microCents: number): number => microCents / 1_000_000;
export const microCentsToDollars = (microCents: number): number => microCents / 100_000_000;
