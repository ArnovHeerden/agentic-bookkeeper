import { describe, expect, it } from "vitest";
import {
  AccountSchema,
  CategorizationResultSchema,
  CategorizeError,
  TransactionSchema,
  err,
  ok,
} from "../src/index.js";

describe("TransactionSchema", () => {
  it("accepts a minimal valid transaction with currency default", () => {
    const result = TransactionSchema.safeParse({
      description: "ABSA RENT",
      amount: -8500,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("ZAR");
    }
  });

  it("rejects empty description", () => {
    const result = TransactionSchema.safeParse({ description: "", amount: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects non-finite amount (NaN, Infinity)", () => {
    expect(TransactionSchema.safeParse({ description: "x", amount: NaN }).success).toBe(false);
    expect(TransactionSchema.safeParse({ description: "x", amount: Infinity }).success).toBe(false);
  });

  it("rejects currency code not exactly 3 chars", () => {
    expect(
      TransactionSchema.safeParse({ description: "x", amount: 1, currency: "RAND" }).success,
    ).toBe(false);
    expect(
      TransactionSchema.safeParse({ description: "x", amount: 1, currency: "R" }).success,
    ).toBe(false);
  });
});

describe("AccountSchema", () => {
  it("requires a 4-digit code", () => {
    expect(
      AccountSchema.safeParse({ code: "6920", name: "Fuel", category: "EXPENSE" }).success,
    ).toBe(true);
    expect(
      AccountSchema.safeParse({ code: "692", name: "Fuel", category: "EXPENSE" }).success,
    ).toBe(false);
    expect(
      AccountSchema.safeParse({ code: "69200", name: "Fuel", category: "EXPENSE" }).success,
    ).toBe(false);
    expect(
      AccountSchema.safeParse({ code: "ABCD", name: "Fuel", category: "EXPENSE" }).success,
    ).toBe(false);
  });

  it("only allows the IFRS-aligned category enum", () => {
    for (const category of ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const) {
      expect(AccountSchema.safeParse({ code: "1000", name: "x", category }).success).toBe(true);
    }
    expect(AccountSchema.safeParse({ code: "1000", name: "x", category: "OTHER" }).success).toBe(
      false,
    );
  });
});

describe("CategorizationResultSchema", () => {
  const valid = {
    accountCode: "6920",
    accountName: "Fuel & Oil",
    confidence: 0.92,
    vatApplicable: true,
    reasoning: "Shell forecourt indicates vehicle fuel purchase, standard 15% input VAT applies.",
  };

  it("accepts a well-formed result", () => {
    expect(CategorizationResultSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects confidence outside [0, 1]", () => {
    expect(CategorizationResultSchema.safeParse({ ...valid, confidence: 1.5 }).success).toBe(false);
    expect(CategorizationResultSchema.safeParse({ ...valid, confidence: -0.1 }).success).toBe(
      false,
    );
  });

  it("rejects reasoning over 400 chars", () => {
    const long = "x".repeat(401);
    expect(CategorizationResultSchema.safeParse({ ...valid, reasoning: long }).success).toBe(false);
  });

  it("rejects malformed account codes", () => {
    expect(CategorizationResultSchema.safeParse({ ...valid, accountCode: "692" }).success).toBe(
      false,
    );
  });
});

describe("Result helpers", () => {
  it("ok() wraps a value with discriminator true", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("err() wraps an error with discriminator false", () => {
    const r = err("nope");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("nope");
  });

  it("ok and err produce mutually-exclusive discriminated union", () => {
    const okResult = ok("yes");
    const errResult = err("no");
    expect(okResult.ok).not.toBe(errResult.ok);
  });
});

describe("CategorizeError", () => {
  it("preserves the kind discriminator", () => {
    const e = new CategorizeError("PARSE_ERROR", "bad");
    expect(e.kind).toBe("PARSE_ERROR");
    expect(e.name).toBe("CategorizeError");
    expect(e.message).toBe("bad");
  });

  it("threads the cause through Error options", () => {
    const cause = new Error("root");
    const e = new CategorizeError("PROVIDER_ERROR", "wrap", { cause });
    expect(e.cause).toBe(cause);
  });

  it("is throwable and catchable as a regular Error", () => {
    expect(() => {
      throw new CategorizeError("VALIDATION_ERROR", "x");
    }).toThrow(CategorizeError);
  });
});
