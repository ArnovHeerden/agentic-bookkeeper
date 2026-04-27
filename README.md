# agentic-bookkeeper

> Agentic chart-of-accounts categorisation for bank transactions, powered by Claude.

[![CI](https://github.com/ArnovHeerden/agentic-bookkeeper/actions/workflows/ci.yml/badge.svg)](https://github.com/ArnovHeerden/agentic-bookkeeper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

A small, focused TypeScript library that takes an ambiguous bank transaction and returns a Chart-of-Accounts categorisation — account code, confidence score, VAT applicability, and natural-language reasoning — using Claude as the reasoning engine.

> **Status:** v0.1.0 in development. This README is a placeholder; the library proper lands in subsequent commits. Track progress in [CHANGELOG.md](CHANGELOG.md).

## Why this exists

Built as a focused extraction from [Axiomatics](https://axiomatics.co.za) — a production agentic accounting platform — to demonstrate production-grade patterns for LLM-driven structured reasoning over a domain (South African IFRS-compliant bookkeeping) where wrong answers have real consequences.

## Production patterns covered

- **Structured outputs** validated with Zod schemas (compile-time + runtime contracts)
- **Prompt caching** via Anthropic `cache_control` blocks (~90% cost reduction on repeated runs)
- **Multi-provider abstraction** — `LLMProvider` interface; ships with `AnthropicProvider`
- **Retry with exponential backoff + jitter** — distinguishes retryable vs non-retryable errors
- **Token counting + cost reporting** via observability callbacks
- **Evaluation harness** — labeled dataset with accuracy reporting per account class
- **Cached deterministic responses** — run the test suite without an API key

## License

MIT — see [LICENSE](LICENSE).

## Security

See [SECURITY.md](SECURITY.md) for vulnerability disclosure.

## Author

[Arno van Heerden](https://github.com/ArnovHeerden) — engineer behind [Axiomatics](https://axiomatics.co.za).
