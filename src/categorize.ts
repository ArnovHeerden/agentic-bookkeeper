import {
  CategorizationResultSchema,
  CategorizeError,
  TransactionSchema,
  err,
  ok,
  type Account,
  type CategorizationResult,
  type Result,
  type Transaction,
} from "./schemas.js";
import { SA_PTY_COA } from "./internal/coa-sa-pty.js";
import { estimateCostMicroCents } from "./cost.js";
import { NOOP_OBSERVER, safeInvoke, type Observer } from "./observability.js";
import {
  DEFAULT_RETRY_CONFIG,
  backoffDelayMs,
  isRetryable,
  sleep,
  type RetryConfig,
} from "./retry.js";
import {
  CATEGORIZE_V1_TOOL,
  buildSystemBlocks,
  buildUserMessage,
} from "./prompts/categorize-v1.js";
import type { LLMProvider, ProviderRequest } from "./providers/types.js";

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.1;

export interface CategorizeOptions {
  /** The bank transaction to categorise. */
  readonly transaction: Transaction;
  /** LLM provider implementation (e.g. AnthropicProvider). */
  readonly provider: LLMProvider;
  /** Chart of Accounts to choose from. Defaults to the SA Pty Ltd reference. */
  readonly accounts?: readonly Account[];
  /** Observer for telemetry (token usage, cost, retries, errors). */
  readonly observer?: Observer;
  /** Retry configuration. Merged into defaults. */
  readonly retry?: Partial<RetryConfig>;
  /** Model name. Defaults to claude-haiku-4-5. */
  readonly model?: string;
  /** Max tokens for the response. Defaults to 1024. */
  readonly maxTokens?: number;
  /** Sampling temperature. Defaults to 0.1 (low for categorisation determinism). */
  readonly temperature?: number;
}

/**
 * Suggest a Chart-of-Accounts categorisation for a single bank transaction.
 *
 * The agent loop:
 *   1. Validate the input transaction (Zod).
 *   2. Build the prompt: cacheable system rules + cacheable account list +
 *      per-call user message.
 *   3. Call the provider with forced tool-use (model MUST emit a tool call).
 *   4. Validate the tool input against the output Zod schema.
 *   5. Verify the suggested account code exists in the supplied CoA.
 *   6. Retry transient failures (429, 5xx, network) with exponential backoff
 *      + full jitter. Fail fast on terminal failures (4xx auth/validation).
 *
 * @returns A Result discriminated union — never throws on expected failure modes.
 *          Unexpected errors (programmer bugs) still throw.
 */
export async function categorize(
  options: CategorizeOptions,
): Promise<Result<CategorizationResult, CategorizeError>> {
  const transactionParse = TransactionSchema.safeParse(options.transaction);
  if (!transactionParse.success) {
    return err(
      new CategorizeError("VALIDATION_ERROR", "Invalid transaction input", {
        cause: transactionParse.error,
      }),
    );
  }
  const transaction = transactionParse.data;

  const accounts = options.accounts ?? SA_PTY_COA;
  const observer = options.observer ?? NOOP_OBSERVER;
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const retryConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retry };

  const request: ProviderRequest = {
    model,
    maxTokens,
    temperature,
    system: buildSystemBlocks(accounts),
    user: buildUserMessage(transaction),
    tool: CATEGORIZE_V1_TOOL,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    safeInvoke(observer.onAttempt, attempt, retryConfig.maxAttempts);

    try {
      const response = await options.provider.call(request);

      safeInvoke(observer.onTokens, response.usage);
      safeInvoke(observer.onCost, estimateCostMicroCents(response.usage, model), model);

      const validated = CategorizationResultSchema.safeParse(response.toolInput);
      if (!validated.success) {
        return err(
          new CategorizeError("PARSE_ERROR", "LLM tool input failed schema validation", {
            cause: validated.error,
          }),
        );
      }

      const matched = accounts.find((a) => a.code === validated.data.accountCode);
      if (!matched) {
        return err(
          new CategorizeError(
            "INVALID_ACCOUNT_SUGGESTION",
            `LLM suggested account code ${validated.data.accountCode} which is not in the supplied Chart of Accounts`,
          ),
        );
      }

      return ok(validated.data);
    } catch (e) {
      lastError = e;
      safeInvoke(observer.onError, e, attempt);

      if (!isRetryable(e)) {
        return err(
          new CategorizeError("PROVIDER_ERROR", "Provider call failed (terminal error)", {
            cause: e,
          }),
        );
      }

      if (attempt < retryConfig.maxAttempts) {
        await sleep(backoffDelayMs(attempt, retryConfig));
      }
    }
  }

  return err(
    new CategorizeError(
      "MAX_RETRIES_EXCEEDED",
      `Provider call failed after ${String(retryConfig.maxAttempts)} attempts`,
      { cause: lastError },
    ),
  );
}
