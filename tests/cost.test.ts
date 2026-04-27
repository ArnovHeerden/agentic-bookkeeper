import { describe, expect, it } from "vitest";
import {
  MODEL_PRICING,
  estimateCostMicroCents,
  microCentsToCents,
  microCentsToDollars,
} from "../src/index.js";

describe("estimateCostMicroCents", () => {
  it("returns 0 for unknown models (no throw)", () => {
    const cost = estimateCostMicroCents(
      { inputTokens: 1000, outputTokens: 500 },
      "claude-imaginary-99",
    );
    expect(cost).toBe(0);
  });

  it("computes cold-call cost for haiku", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 500_000 };
    const cost = estimateCostMicroCents(usage, "claude-haiku-4-5");
    const pricing = MODEL_PRICING["claude-haiku-4-5"]!;
    expect(cost).toBe(pricing.inputPerMillion + pricing.outputPerMillion / 2);
  });

  it("applies cache_read discount (~10% of base input)", () => {
    const fullPrice = estimateCostMicroCents(
      { inputTokens: 1_000_000, outputTokens: 0 },
      "claude-haiku-4-5",
    );
    const cachedPrice = estimateCostMicroCents(
      { inputTokens: 1_000_000, outputTokens: 0, cacheReadInputTokens: 1_000_000 },
      "claude-haiku-4-5",
    );
    const ratio = cachedPrice / fullPrice;
    expect(ratio).toBeLessThan(0.15);
    expect(ratio).toBeGreaterThan(0.05);
  });

  it("applies cache_write premium (~125% of base input)", () => {
    const fullPrice = estimateCostMicroCents(
      { inputTokens: 1_000_000, outputTokens: 0 },
      "claude-haiku-4-5",
    );
    const writePrice = estimateCostMicroCents(
      { inputTokens: 1_000_000, outputTokens: 0, cacheCreationInputTokens: 1_000_000 },
      "claude-haiku-4-5",
    );
    expect(writePrice).toBeGreaterThan(fullPrice);
    expect(writePrice / fullPrice).toBeCloseTo(1.25, 1);
  });

  it("combines fresh + cached + cache_write input correctly", () => {
    const usage = {
      inputTokens: 3_000_000,
      outputTokens: 0,
      cacheReadInputTokens: 1_000_000,
      cacheCreationInputTokens: 1_000_000,
    };
    const cost = estimateCostMicroCents(usage, "claude-haiku-4-5");
    const pricing = MODEL_PRICING["claude-haiku-4-5"]!;
    // 1M fresh @ base + 1M cache_read @ discounted + 1M cache_write @ premium
    const expected =
      pricing.inputPerMillion + pricing.cacheReadPerMillion + pricing.cacheWritePerMillion;
    expect(cost).toBe(expected);
  });

  it("scales linearly with output tokens", () => {
    const cost1 = estimateCostMicroCents(
      { inputTokens: 0, outputTokens: 1000 },
      "claude-sonnet-4-6",
    );
    const cost2 = estimateCostMicroCents(
      { inputTokens: 0, outputTokens: 2000 },
      "claude-sonnet-4-6",
    );
    expect(cost2).toBeCloseTo(cost1 * 2, 5);
  });

  it("opus is more expensive than haiku for the same usage", () => {
    const usage = { inputTokens: 100_000, outputTokens: 50_000 };
    const haiku = estimateCostMicroCents(usage, "claude-haiku-4-5");
    const opus = estimateCostMicroCents(usage, "claude-opus-4-7");
    expect(opus).toBeGreaterThan(haiku * 5);
  });
});

describe("unit conversions", () => {
  it("microCentsToCents divides by 1M", () => {
    expect(microCentsToCents(1_000_000)).toBe(1);
    expect(microCentsToCents(123_456_789)).toBeCloseTo(123.456789, 6);
  });

  it("microCentsToDollars divides by 100M", () => {
    expect(microCentsToDollars(100_000_000)).toBe(1);
    expect(microCentsToDollars(50_000_000)).toBe(0.5);
  });
});
