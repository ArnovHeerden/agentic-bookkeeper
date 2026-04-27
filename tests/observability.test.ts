import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Observer } from "../src/index.js";
// safeInvoke is internal but exercised via the categorize agent flow elsewhere;
// here we import it directly to verify its swallow-and-log contract.
import { NOOP_OBSERVER, safeInvoke } from "../src/observability.js";

describe("NOOP_OBSERVER", () => {
  it("is an empty object — no hooks defined", () => {
    expect(Object.keys(NOOP_OBSERVER)).toHaveLength(0);
  });

  it("can be safely passed to safeInvoke for any hook", () => {
    expect(() => {
      safeInvoke(NOOP_OBSERVER.onTokens, { inputTokens: 0, outputTokens: 0 });
      safeInvoke(NOOP_OBSERVER.onCost, 0, "claude-haiku-4-5");
      safeInvoke(NOOP_OBSERVER.onAttempt, 1, 3);
      safeInvoke(NOOP_OBSERVER.onError, new Error("x"), 1);
    }).not.toThrow();
  });
});

describe("safeInvoke", () => {
  let warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("calls the hook with the provided args when defined", () => {
    const hook = vi.fn();
    safeInvoke(hook, "a", "b", 1);
    expect(hook).toHaveBeenCalledExactlyOnceWith("a", "b", 1);
  });

  it("is a no-op when the hook is undefined", () => {
    expect(() => safeInvoke(undefined)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("swallows hook errors and writes one console.warn", () => {
    const hook = vi.fn(() => {
      throw new Error("hook blew up");
    });

    expect(() => safeInvoke(hook)).not.toThrow();
    expect(hook).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});

describe("Observer type ergonomics", () => {
  it("accepts a partial observer (all hooks optional)", () => {
    const partial: Observer = { onTokens: () => undefined };
    expect(partial.onCost).toBeUndefined();
    expect(partial.onAttempt).toBeUndefined();
  });

  it("accepts a fully populated observer", () => {
    const full: Observer = {
      onTokens: () => undefined,
      onCost: () => undefined,
      onAttempt: () => undefined,
      onError: () => undefined,
    };
    expect(Object.keys(full)).toHaveLength(4);
  });
});
