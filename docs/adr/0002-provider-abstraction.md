# ADR 0002 — `LLMProvider` interface, not a hardcoded SDK call

**Status:** Accepted, 2026-04-27.

## Context

The straight-line implementation of `categorize()` calls `new Anthropic(...)` directly inside the function. This is the path of least resistance and exactly what most "agentic" tutorials show. It has three costs:

1. **Tests need an API key.** Every test run hits Anthropic, costs money, varies non-deterministically, and can't run in CI without provisioning an org key.
2. **Multi-provider support is a fork.** Adding OpenAI or Gemini means duplicating the agent loop, with all the bugs that brings.
3. **Behavioural extensions are awkward.** Logging requests, measuring per-call latency, or inserting a circuit-breaker requires monkey-patching the SDK or wrapping every call site.

## Decision

Define a small provider-agnostic interface and pass an instance into `categorize()`:

```ts
interface LLMProvider {
  readonly name: string;
  call(request: ProviderRequest): Promise<ProviderResponse>;
}
```

The agent function depends only on the interface. The library ships [`AnthropicProvider`](../../src/providers/anthropic.ts) as the concrete implementation; the test suite supplies an in-process [`MockProvider`](../../tests/categorize.test.ts).

`ProviderRequest` and `ProviderResponse` are intentionally provider-neutral — system blocks marked with a `cache: boolean` flag, a single user message string, a tool definition, and a typed usage block in the response. Provider implementations translate between this shape and their SDK's native types.

## Consequences

**Positive**

- **Tests run offline, in 200ms.** 70 tests, no network, deterministic. CI doesn't need an API key.
- **Adding a provider is mechanical.** A new file (~50 LoC) implementing the interface, plus an `OpenAIProvider` test mirroring the Anthropic one. Zero changes to `categorize.ts`.
- **Composition over modification.** A `LoggingProvider` decorator that wraps any other provider is 15 LoC; same for `RateLimitedProvider`, `CachingProvider`, etc.
- **Forced caller awareness.** Consumers must explicitly construct and inject a provider — there's no implicit "use Anthropic from env vars" default that hides which model is running where.

**Negative**

- **One layer of indirection.** Reading the agent loop requires also reading `providers/types.ts` to understand what `provider.call()` returns. Mitigated by keeping the interface tiny (one method, two types).
- **Cache-control is a leaky abstraction.** The `cache: boolean` flag on system blocks reflects an Anthropic-specific feature. OpenAI's prompt caching uses a different mechanism (50% discount on prefix matches with no explicit flag). The interface picks the more explicit model; an OpenAI provider would simply ignore the flag, accepting that caching is opt-in only on Anthropic.

## Concrete win this enabled

The categorisation test suite (`tests/categorize.test.ts`) exercises every error path — `MAX_RETRIES_EXCEEDED`, `INVALID_ACCOUNT_SUGGESTION`, transient-then-success, terminal-fail-fast — by queueing responses on `MockProvider`. Reproducing those scenarios against a live API would require either fault injection into Anthropic (impossible) or hours of test-driven probabilistic experimentation. The interface makes them deterministic.
