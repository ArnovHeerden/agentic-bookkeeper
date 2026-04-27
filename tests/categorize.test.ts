import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CategorizeError,
  SA_PTY_COA,
  categorize,
  type CategorizationResult,
  type LLMProvider,
  type ProviderRequest,
  type ProviderResponse,
  type Transaction,
} from "../src/index.js";

/**
 * In-memory LLMProvider double. Configure responses or errors per call;
 * inspect callCount and lastRequest after exercising the agent.
 */
class MockProvider implements LLMProvider {
  public readonly name = "mock";
  public callCount = 0;
  public lastRequest: ProviderRequest | undefined = undefined;
  private readonly queue: Array<ProviderResponse | { error: unknown }>;

  constructor(queue: Array<ProviderResponse | { error: unknown }>) {
    this.queue = queue;
  }

  async call(request: ProviderRequest): Promise<ProviderResponse> {
    this.lastRequest = request;
    const item = this.queue[this.callCount];
    this.callCount += 1;
    if (!item) throw new Error(`MockProvider: no item queued for call ${String(this.callCount)}`);
    if ("error" in item) throw item.error;
    return Promise.resolve(item);
  }
}

const validTransaction: Transaction = {
  description: "SHELL ULTRA CITY BLOEMFONTEIN",
  amount: -3950,
  currency: "ZAR",
};

const validToolInput = {
  accountCode: "6920",
  accountName: "Fuel & Oil",
  confidence: 0.92,
  vatApplicable: true,
  reasoning: "Shell forecourt indicates vehicle fuel — standard 15% input VAT applies.",
};

const validResponse: ProviderResponse = {
  toolInput: validToolInput,
  stopReason: "tool_use",
  usage: { inputTokens: 5000, outputTokens: 100 },
};

beforeEach(() => {
  // Make backoffDelayMs return 0 so retry tests don't actually wait.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("categorize — happy path", () => {
  it("returns ok with the validated categorisation result", async () => {
    const provider = new MockProvider([validResponse]);

    const result = await categorize({ transaction: validTransaction, provider });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accountCode).toBe("6920");
      expect(result.value.accountName).toBe("Fuel & Oil");
      expect(result.value.confidence).toBeCloseTo(0.92);
    }
    expect(provider.callCount).toBe(1);
  });

  it("builds a request with cacheable system blocks and forced tool-use", async () => {
    const provider = new MockProvider([validResponse]);

    await categorize({ transaction: validTransaction, provider });

    expect(provider.lastRequest).toBeDefined();
    const request = provider.lastRequest!;
    expect(request.system.length).toBeGreaterThanOrEqual(2);
    expect(request.system.every((b) => b.cache === true)).toBe(true);
    expect(request.tool.name).toBe("suggest_chart_of_accounts_categorisation");
    expect(request.user).toContain("SHELL ULTRA CITY");
  });

  it("uses claude-haiku-4-5 by default", async () => {
    const provider = new MockProvider([validResponse]);
    await categorize({ transaction: validTransaction, provider });
    expect(provider.lastRequest?.model).toBe("claude-haiku-4-5");
  });

  it("respects model override", async () => {
    const provider = new MockProvider([validResponse]);
    await categorize({
      transaction: validTransaction,
      provider,
      model: "claude-sonnet-4-6",
    });
    expect(provider.lastRequest?.model).toBe("claude-sonnet-4-6");
  });
});

describe("categorize — input validation", () => {
  it("returns VALIDATION_ERROR for an empty description", async () => {
    const provider = new MockProvider([]);

    const result = await categorize({
      transaction: { description: "", amount: -100 } as unknown as Transaction,
      provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(CategorizeError);
      expect(result.error.kind).toBe("VALIDATION_ERROR");
    }
    expect(provider.callCount).toBe(0);
  });

  it("returns VALIDATION_ERROR for a non-finite amount", async () => {
    const provider = new MockProvider([]);

    const result = await categorize({
      transaction: {
        description: "x",
        amount: Number.POSITIVE_INFINITY,
      } as unknown as Transaction,
      provider,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("VALIDATION_ERROR");
  });
});

describe("categorize — output validation", () => {
  it("returns PARSE_ERROR when the LLM tool input fails the Zod schema", async () => {
    const badResponse: ProviderResponse = {
      toolInput: {
        accountCode: "BADCODE",
        accountName: "x",
        confidence: 2,
        vatApplicable: true,
        reasoning: "x",
      },
      stopReason: "tool_use",
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    const provider = new MockProvider([badResponse]);

    const result = await categorize({ transaction: validTransaction, provider });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("PARSE_ERROR");
  });

  it("returns INVALID_ACCOUNT_SUGGESTION when code is not in the supplied CoA", async () => {
    const unknownCodeResponse: ProviderResponse = {
      toolInput: { ...validToolInput, accountCode: "9999" },
      stopReason: "tool_use",
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    const provider = new MockProvider([unknownCodeResponse]);

    const result = await categorize({ transaction: validTransaction, provider });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("INVALID_ACCOUNT_SUGGESTION");
  });

  it("respects a custom accounts list", async () => {
    // Custom CoA with only one valid code; LLM suggests a code outside that.
    const customAccounts = SA_PTY_COA.filter((a) => a.code === "1112");

    const provider = new MockProvider([validResponse]); // suggests 6920
    const result = await categorize({
      transaction: validTransaction,
      provider,
      accounts: customAccounts,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("INVALID_ACCOUNT_SUGGESTION");
  });
});

describe("categorize — retry behaviour", () => {
  it("retries transient errors and succeeds on second attempt", async () => {
    const provider = new MockProvider([
      { error: { status: 503, message: "service unavailable" } },
      validResponse,
    ]);

    const result = await categorize({ transaction: validTransaction, provider });

    expect(result.ok).toBe(true);
    expect(provider.callCount).toBe(2);
  });

  it("returns MAX_RETRIES_EXCEEDED after all attempts exhaust", async () => {
    const transient = { error: { status: 429, message: "rate limited" } };
    const provider = new MockProvider([transient, transient, transient]);

    const result = await categorize({
      transaction: validTransaction,
      provider,
      retry: { maxAttempts: 3 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("MAX_RETRIES_EXCEEDED");
    expect(provider.callCount).toBe(3);
  });

  it("fails fast on terminal errors without retrying", async () => {
    const terminal = { error: { status: 401, message: "invalid api key" } };
    const provider = new MockProvider([terminal, validResponse]);

    const result = await categorize({ transaction: validTransaction, provider });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("PROVIDER_ERROR");
    expect(provider.callCount).toBe(1);
  });

  it("merges partial retry config with defaults", async () => {
    const provider = new MockProvider([validResponse]);
    const result = await categorize({
      transaction: validTransaction,
      provider,
      retry: { maxAttempts: 5 },
    });
    expect(result.ok).toBe(true);
  });
});

describe("categorize — observer hooks", () => {
  it("invokes onAttempt, onTokens, onCost on a successful call", async () => {
    const onAttempt = vi.fn();
    const onTokens = vi.fn();
    const onCost = vi.fn();
    const onError = vi.fn();
    const provider = new MockProvider([validResponse]);

    await categorize({
      transaction: validTransaction,
      provider,
      observer: { onAttempt, onTokens, onCost, onError },
    });

    expect(onAttempt).toHaveBeenCalledExactlyOnceWith(1, expect.any(Number));
    expect(onTokens).toHaveBeenCalledExactlyOnceWith(validResponse.usage);
    expect(onCost).toHaveBeenCalledOnce();
    const args = onCost.mock.calls[0];
    expect(args?.[0]).toBeGreaterThan(0);
    expect(args?.[1]).toBe("claude-haiku-4-5");
    expect(onError).not.toHaveBeenCalled();
  });

  it("invokes onError on a transient failure (still retries)", async () => {
    const onError = vi.fn();
    const onAttempt = vi.fn();
    const provider = new MockProvider([{ error: { status: 502 } }, validResponse]);

    const result = await categorize({
      transaction: validTransaction,
      provider,
      observer: { onError, onAttempt },
    });

    expect(result.ok).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it("does not throw when observer hooks themselves throw", async () => {
    const provider = new MockProvider([validResponse]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await categorize({
      transaction: validTransaction,
      provider,
      observer: {
        onTokens: () => {
          throw new Error("hook explosion");
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("categorize — return type ergonomics", () => {
  it("ok branch narrows result.value to CategorizationResult", async () => {
    const provider = new MockProvider([validResponse]);
    const result = await categorize({ transaction: validTransaction, provider });

    if (result.ok) {
      const value: CategorizationResult = result.value;
      expect(value.accountCode).toBe("6920");
    } else {
      throw new Error("expected ok branch");
    }
  });
});
