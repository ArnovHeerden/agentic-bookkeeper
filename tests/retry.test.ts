import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RETRY_CONFIG, backoffDelayMs, isRetryable } from "../src/index.js";

describe("isRetryable", () => {
  it("returns true for retryable HTTP status codes", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryable({ status })).toBe(true);
    }
  });

  it("returns false for terminal HTTP status codes", () => {
    for (const status of [400, 401, 403, 404, 409, 413, 422]) {
      expect(isRetryable({ status })).toBe(false);
    }
  });

  it("reads status from nested error.status (Anthropic SDK shape)", () => {
    expect(isRetryable({ error: { status: 429 } })).toBe(true);
    expect(isRetryable({ error: { status: 401 } })).toBe(false);
  });

  it("reads status from statusCode (alternative SDK convention)", () => {
    expect(isRetryable({ statusCode: 503 })).toBe(true);
    expect(isRetryable({ statusCode: 422 })).toBe(false);
  });

  it("returns true for transient network error codes", () => {
    for (const code of ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"]) {
      expect(isRetryable({ code })).toBe(true);
    }
  });

  it("returns false for unknown error codes", () => {
    expect(isRetryable({ code: "EWHATEVER" })).toBe(false);
  });

  it("returns false for non-error inputs", () => {
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
    expect(isRetryable("string")).toBe(false);
    expect(isRetryable(42)).toBe(false);
    expect(isRetryable({})).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("never exceeds maxDelayMs", () => {
    const config = { maxAttempts: 10, baseDelayMs: 100, maxDelayMs: 5000 };
    for (let attempt = 1; attempt <= 20; attempt++) {
      const delay = backoffDelayMs(attempt, config);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
    }
  });

  it("grows exponentially in expectation across attempts", () => {
    // With full jitter the value is random in [0, cap], but the cap doubles
    // each attempt until maxDelayMs. Sample many runs and assert the mean
    // for attempt 4 exceeds the mean for attempt 1.
    const config = { maxAttempts: 10, baseDelayMs: 50, maxDelayMs: 60_000 };
    const samples = 200;
    const meanAt = (attempt: number): number => {
      let total = 0;
      for (let i = 0; i < samples; i++) total += backoffDelayMs(attempt, config);
      return total / samples;
    };
    expect(meanAt(4)).toBeGreaterThan(meanAt(1) * 2);
  });

  it("uses DEFAULT_RETRY_CONFIG when none provided", () => {
    const delay = backoffDelayMs(1);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
  });
});

describe("DEFAULT_RETRY_CONFIG", () => {
  it("has sensible production defaults", () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBeLessThanOrEqual(10);
    expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBeGreaterThan(DEFAULT_RETRY_CONFIG.baseDelayMs);
  });
});

describe("Math.random determinism in backoffDelayMs", () => {
  it("returns 0 when Math.random is mocked to 0", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(backoffDelayMs(5)).toBe(0);
    spy.mockRestore();
  });
});
