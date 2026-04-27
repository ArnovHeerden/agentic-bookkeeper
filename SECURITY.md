# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in `agentic-bookkeeper`, please report it privately rather than opening a public issue.

**Preferred channel:** GitHub Security Advisories — open a [private vulnerability report](https://github.com/ArnovHeerden/agentic-bookkeeper/security/advisories/new).

**Alternative:** email arnovanheerden50@gmail.com with subject `[agentic-bookkeeper] security report`.

You can expect:

- Acknowledgement within 48 hours
- An initial assessment within 7 days
- A resolution timeline shared within 14 days

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure) — please give us reasonable time to fix the issue before public disclosure.

## Scope

In scope:

- The library code in `src/`
- Build & release pipeline
- Dependencies pulled in by `package.json`

Out of scope:

- Vulnerabilities in your own application code that consumes this library
- Vulnerabilities in upstream LLM providers (report those to the provider directly)

## Security Posture

This library:

- Has zero runtime dependencies beyond `@anthropic-ai/sdk` and `zod`
- Does not collect or transmit telemetry
- Does not persist user data anywhere
- Treats all input as untrusted (Zod-validated at the boundary)
- Runs `gitleaks` on every commit and CI build
- Has GitHub Secret Scanning + Push Protection enabled
- Has Dependabot security updates enabled
- Releases are signed git tags
