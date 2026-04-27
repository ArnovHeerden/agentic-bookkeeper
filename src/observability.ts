import type { TokenUsage } from "./cost.js";

/**
 * Observability hooks for the categorize() agent loop.
 *
 * Hooks are best-effort: callers can attach a partial Observer and the agent
 * will only call the methods that are defined. Errors thrown from inside a
 * hook are logged but never propagate (we don't want telemetry to break the
 * primary code path).
 */
export interface Observer {
  /** Called once per provider call with raw token usage. */
  onTokens?: (usage: TokenUsage) => void;
  /** Called once per provider call with computed cost in micro-cents. */
  onCost?: (microCents: number, model: string) => void;
  /** Called at the start of each retry attempt. `attempt` is 1-indexed. */
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  /** Called when an error is caught (whether retried or not). */
  onError?: (error: unknown, attempt: number) => void;
}

/**
 * No-op observer used when the caller doesn't pass one.
 */
export const NOOP_OBSERVER: Observer = {};

/**
 * Safely invoke a hook — swallows any thrown error and writes a single
 * line to console.warn. Used internally; not exported.
 */
export function safeInvoke<Args extends readonly unknown[]>(
  hook: ((...args: Args) => void) | undefined,
  ...args: Args
): void {
  if (!hook) return;
  try {
    hook(...args);
  } catch (e) {
    console.warn("[agentic-bookkeeper] observer hook threw:", e);
  }
}
