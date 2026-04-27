/**
 * agentic-bookkeeper — public API.
 *
 * Quickstart:
 *
 *   import { categorize, AnthropicProvider } from "agentic-bookkeeper";
 *
 *   const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! });
 *
 *   const result = await categorize({
 *     transaction: { description: "SHELL ULTRA CITY", amount: -3950 },
 *     provider,
 *   });
 *
 *   if (result.ok) console.log(result.value);
 *   else console.error(result.error.kind, result.error.message);
 */

// ── Main agent function ────────────────────────────────────
export { categorize, type CategorizeOptions } from "./categorize.js";

// ── Provider abstraction ───────────────────────────────────
export type {
  LLMProvider,
  ProviderRequest,
  ProviderResponse,
  SystemBlock,
  ToolDefinition,
} from "./providers/types.js";
export { AnthropicProvider, type AnthropicProviderConfig } from "./providers/anthropic.js";

// ── Data shapes ────────────────────────────────────────────
export {
  AccountSchema,
  CategorizationResultSchema,
  CategorizeError,
  TransactionSchema,
  err,
  ok,
  type Account,
  type CategorizationResult,
  type CategorizeErrorKind,
  type Err,
  type Ok,
  type Result,
  type Transaction,
} from "./schemas.js";

// ── Observability ──────────────────────────────────────────
export { NOOP_OBSERVER, type Observer } from "./observability.js";

// ── Cost estimation ────────────────────────────────────────
export {
  MODEL_PRICING,
  estimateCostMicroCents,
  microCentsToCents,
  microCentsToDollars,
  type ModelPricing,
  type TokenUsage,
} from "./cost.js";

// ── Retry configuration ────────────────────────────────────
export { DEFAULT_RETRY_CONFIG, backoffDelayMs, isRetryable, type RetryConfig } from "./retry.js";

// ── Reference data (SA Pty Ltd Chart of Accounts) ──────────
export { SA_PTY_COA, getAccountByCode, getSuggestableAccounts } from "./internal/coa-sa-pty.js";

// ── Prompt artifact (versioned) ────────────────────────────
export {
  CATEGORIZE_V1_VERSION,
  CATEGORIZE_V1_RULES,
  CATEGORIZE_V1_TOOL,
  buildSystemBlocks,
  buildUserMessage,
} from "./prompts/categorize-v1.js";

// ── Library version ────────────────────────────────────────
export const VERSION = "0.1.0";
