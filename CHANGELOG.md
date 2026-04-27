# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-27

Initial release. Extracted as a focused module from the production [Axiomatics](https://axiomatics.co.za) accounting platform to demonstrate production-grade agentic AI patterns.

### Added

- Public API: `categorize()` agent function with Zod-validated input + output
- `LLMProvider` interface and `AnthropicProvider` implementation with prompt-cache support (`cache_control: { type: "ephemeral" }`)
- Versioned prompt artifact (`categorize-v1`) — cacheable system blocks for SA bookkeeping rules + 140-account CoA reference
- Production primitives: `Result<T, E>` discriminated union, `CategorizeError` with typed `kind` discriminator, retry with exponential backoff + full jitter, token-cost estimation per model
- `Observer` interface for telemetry hooks (`onTokens`, `onCost`, `onAttempt`, `onError`) with safe-invoke wrapper
- 70-test suite covering schemas, retry classification, cost math, observer contract, Anthropic SDK request/response shape, and full agent flow with mocked provider — runs offline in <200ms
- Coverage thresholds (lines 90, branches 85, functions 85, statements 90) enforced in CI
- CLI demo (`npm run example`) — categorises 20 synthetic Karoo Coffee Roasters transactions with token/cost summary
- Eval harness (`npm run eval`) — 25 SA-specific labelled transactions, strict + tolerant accuracy reporting, CI-ready exit codes
- Repository scaffolding: TypeScript strict mode, ESLint flat config, Prettier, Vitest 4, Husky 9, lint-staged, conventional commits via commitlint
- GitHub Actions CI pipeline: typecheck + lint + format + tests on Node 20+22, build verification, gitleaks secret scanning
- CodeQL workflow + Dependabot configuration (minor/patch only — major bumps require manual review)
- Documentation: full README, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) with Mermaid diagrams, three ADRs covering Zod validation, provider abstraction, and prompt versioning

### Security

- `gitleaks` scan clean across full git history (13 commits)
- `trufflehog` filesystem scan clean (0 verified or unverified secrets)
- GitHub Secret Scanning + Push Protection enabled at the repo level
- 0 npm vulnerabilities in production or dev dependencies
- Repository-level audit confirmed no production references (no `axiomatics-web` GCP project ID, no production API keys, no client names from production CRM)

[Unreleased]: https://github.com/ArnovHeerden/agentic-bookkeeper/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ArnovHeerden/agentic-bookkeeper/releases/tag/v0.1.0
