# ADR 0003 — Versioned prompt artifacts with `cache_control` blocks

**Status:** Accepted, 2026-04-27.

## Context

Most "agentic" code I've reviewed treats the system prompt as a string literal in the same file as the function that uses it. This works until any of:

- You want to A/B test two prompt versions against the same eval set.
- You want to roll back a prompt change without reverting unrelated code.
- You want to bisect a regression: which prompt caused accuracy to drop from 92% to 84%?
- You want to measure the actual cost impact of prompt caching, not just the theoretical 90% saving.

A prompt is an engineering artifact — versioned, reviewed, tested, and benchmarked — not a copy-paste detail buried in a function body.

## Decision

Each prompt lives in its own file under [`src/prompts/`](../../src/prompts/) named `<name>-v<n>.ts`. The current categorisation prompt is `categorize-v1.ts`. The file exports:

- `CATEGORIZE_V1_VERSION` — semver string for telemetry / eval correlation
- `CATEGORIZE_V1_RULES` — the full system prompt as a single string constant
- `CATEGORIZE_V1_TOOL` — the JSON Schema tool definition (matches [ADR 0001](0001-zod-for-output-validation.md))
- `buildSystemBlocks(accounts)` — returns the structured `SystemBlock[]` the provider expects, with `cache: true` on the static blocks
- `buildUserMessage(transaction)` — the per-call dynamic content

The `cache: true` flag on static blocks is what triggers Anthropic's `cache_control: { type: "ephemeral" }` in the [provider implementation](../../src/providers/anthropic.ts).

When the prompt changes meaningfully — new categorisation rules, schema fields, or output format — copy the file to `categorize-v2.ts`, bump `CATEGORIZE_V*_VERSION`, and run the eval suite against both side-by-side before swapping the import in `categorize.ts`.

## Consequences

**Positive**

- **Diffs are honest.** Changing a prompt rule shows up as a `categorize-v1.ts` diff, not a 500-character edit buried inside `categorize.ts`. Reviewers see exactly what changed.
- **A/B testing is mechanical.** Run the eval harness against `categorize-v1` and `categorize-v2` in parallel, compare accuracy + cost. The eval dataset in [`evals/dataset.json`](../../evals/dataset.json) doesn't care which version you're running.
- **Prompt caching pays off.** Both static blocks (rules, ~1650 words; CoA list, ~3500 tokens) are sent every call but charged at the cache_read rate (~10% of input price) on warm calls. Effective input cost on a 20-transaction batch is roughly 14% of the non-cached implementation. Telemetry confirms it via `cache_read_input_tokens` propagating through [cost.ts](../../src/cost.ts).
- **Roll-forward is safe.** `v2` ships as a new file. If accuracy regresses, revert one import line. No string-edit cleanup, no merge conflicts on the old prompt.

**Negative**

- **The CoA list is duplicated between the prompt block and the JS reference data.** Both sources are needed (the model needs the natural-language list; the agent needs the typed `Account[]` to validate the suggested code against). They're rendered from the same `Account[]` array via `buildSystemBlocks`, so drift is impossible at runtime — but the renderer adds one layer of indirection.
- **Two cacheable blocks instead of one.** Anthropic's cache hit requires byte-exact match. Splitting into rules + accounts means a CoA change invalidates the accounts cache while the rules cache survives. This is a feature in production (you can update accounts without burning rules-cache hits) but worth flagging — both blocks must be stable across calls within a session for caching to pay off.

## What "v2" would look like

Likely first prompt revision:

- Add an `acceptableAlternatives: string[]` field to the output schema so the model can express its second-best guesses, feeding richer eval signal.
- Tighten `confidence` calibration with a few-shot block at the top.
- Re-order the rules so the most-violated patterns (director loan vs share capital, fuel forecourt) appear first — model attention drops with depth.

Each of those is a candidate for an A/B comparison once `v2` lands.
