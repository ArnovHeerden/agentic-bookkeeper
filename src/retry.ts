/**
 * Retry helpers for LLM calls.
 *
 * Distinguishes retryable transient failures (rate limits, server errors,
 * network blips) from terminal failures (auth errors, invalid request).
 * Uses exponential backoff with full jitter to avoid thundering-herd
 * synchronisation across concurrent callers.
 */

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

/**
 * Determine whether an error is worth retrying. Looks for HTTP status codes
 * on the error object (Anthropic SDK surfaces `status` and `error.status`).
 *
 * Retryable: 408, 425, 429, 500, 502, 503, 504, plus any ECONN* network code.
 * Non-retryable: 400, 401, 403, 404, 409, 413, 422 — bug or auth, not transient.
 */
export function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const status = readStatus(error);
  if (status !== undefined) {
    if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true;
    if (status >= 400 && status < 500) return false;
    return false;
  }

  const code = readCode(error);
  if (code !== undefined) {
    return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(code);
  }

  return false;
}

/**
 * Compute the next backoff delay. `attempt` is 1-indexed (first retry = 1).
 * Formula: full-jitter exponential — random([0, min(maxDelayMs, base * 2^attempt)]).
 */
export function backoffDelayMs(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const exponential = config.baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const cap = Math.min(config.maxDelayMs, exponential);
  return Math.floor(Math.random() * cap);
}

/**
 * Sleep for the given number of milliseconds.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface ErrorWithStatus {
  status?: unknown;
  statusCode?: unknown;
  error?: { status?: unknown };
}

interface ErrorWithCode {
  code?: unknown;
}

function readStatus(error: object): number | undefined {
  const e = error as ErrorWithStatus;
  const candidates = [e.status, e.statusCode, e.error?.status];
  for (const candidate of candidates) {
    if (typeof candidate === "number") return candidate;
  }
  return undefined;
}

function readCode(error: object): string | undefined {
  const code = (error as ErrorWithCode).code;
  return typeof code === "string" ? code : undefined;
}
