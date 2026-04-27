import { z } from "zod";

/**
 * Bank transaction input. Amount is signed (negative = expense, positive = income)
 * and expressed in the smallest currency unit (e.g. cents for ZAR).
 */
export const TransactionSchema = z.object({
  description: z.string().min(1).max(500),
  amount: z.number().finite(),
  currency: z.string().length(3).default("ZAR"),
  date: z.string().optional(),
  reference: z.string().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

/**
 * A Chart-of-Accounts entry. Mirrors the IFRS-aligned classification used by
 * the SA Pty Ltd reference (see src/internal/coa-sa-pty.ts).
 */
export const AccountSchema = z.object({
  code: z.string().regex(/^\d{4}$/, "Account code must be 4 digits"),
  name: z.string().min(1),
  category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  subcategory: z.string().optional(),
  vatApplicable: z.boolean().default(true),
  systemGenerated: z.boolean().default(false),
});

export type Account = z.infer<typeof AccountSchema>;

/**
 * The agent's structured answer for a single transaction.
 * `confidence` ∈ [0, 1]. `reasoning` is capped at ~40 words.
 */
export const CategorizationResultSchema = z.object({
  accountCode: z.string().regex(/^\d{4}$/),
  accountName: z.string().min(1),
  confidence: z.number().min(0).max(1),
  vatApplicable: z.boolean(),
  reasoning: z.string().min(1).max(400),
});

export type CategorizationResult = z.infer<typeof CategorizationResultSchema>;

/**
 * Discriminated-union Result type. Forces consumers to handle the error path
 * at the type level rather than relying on thrown exceptions.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/**
 * Library-level error class. `kind` lets callers branch on failure mode without
 * pattern-matching on message strings.
 */
export type CategorizeErrorKind =
  | "PROVIDER_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "INVALID_ACCOUNT_SUGGESTION"
  | "MAX_RETRIES_EXCEEDED";

export class CategorizeError extends Error {
  public readonly kind: CategorizeErrorKind;

  constructor(kind: CategorizeErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CategorizeError";
    this.kind = kind;
  }
}
