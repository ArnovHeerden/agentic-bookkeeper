# ADR 0001 — Zod for input + output validation

**Status:** Accepted, 2026-04-27.

## Context

LLM output is fundamentally untrusted: even with `tool_choice` forcing a structured JSON tool call, the model can emit malformed values, fields outside enums, numbers outside bounds, or hallucinated keys. Returning that to a caller without validation pushes runtime errors deeper into the consumer's stack, where they crash unrelated code paths and produce poor error messages.

Three options were considered:

1. **Hand-written validators** (`if (typeof x.code !== "string") throw...`) — verbose, drifts from the type definitions, no auto-generated error messages.
2. **TypeScript types only** — compile-time only; provides zero runtime guarantee against an LLM emitting `confidence: 1.5`.
3. **Zod** — single source of truth: a schema produces both the runtime validator (`safeParse`) and the inferred TypeScript type (`z.infer`).

## Decision

Use Zod for both directions:

- **Input** — `TransactionSchema.safeParse(options.transaction)` runs before any provider call. Invalid input never wastes a token.
- **Output** — `CategorizationResultSchema.safeParse(response.toolInput)` runs on every tool-call result. Invalid output produces a typed `PARSE_ERROR` instead of corrupting downstream code.

The schemas live in [`src/schemas.ts`](../../src/schemas.ts); inferred types are exported alongside.

## Consequences

**Positive**

- Compile-time and runtime contracts derived from one definition. Renaming a field updates types everywhere automatically.
- Validation errors carry structured paths (`response.toolInput.confidence: expected number, got string`) that make prompt-engineering bugs debuggable in seconds.
- The tool schema sent to Anthropic mirrors the Zod schema 1:1, reducing the chance of drift between what the model is told and what we accept back.

**Negative**

- One runtime dependency (Zod is ~50KB minified). Acceptable — it's already an industry-standard choice for LLM apps in 2026.
- A small amount of duplication: the JSON Schema in [`prompts/categorize-v1.ts`](../../src/prompts/categorize-v1.ts) is hand-maintained alongside the Zod schema. Considered using `zod-to-json-schema` but rejected — Anthropic's tool schema dialect is a JSON Schema subset, and a tool registered with the wrong shape silently degrades model performance, so explicit hand-curation is the safer trade-off.

## Alternatives considered later

If TypeScript ships native runtime types (the long-discussed "decorators" / "transparent types" proposal), revisit. Until then Zod remains the right choice.
