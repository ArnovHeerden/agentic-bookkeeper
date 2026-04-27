# Evals

A small accuracy harness for the categorisation agent.

## What's here

- **`dataset.json`** — 25 labelled bank transactions with primary expected account codes plus acceptable alternatives. Designed to exercise the prompt's SA-specific reasoning rules (director loan vs share capital, fuel forecourts, Section 18A donations, SARS penalties, municipal rates, etc.) rather than just routine categorisations a keyword-matcher could solve.
- **`run-eval.ts`** — runs `categorize()` against every entry, reports two accuracy figures (strict = primary code only; tolerant = primary OR acceptable), surfaces misses with the model's reasoning, and prints token/cost telemetry. Exits non-zero if tolerant accuracy drops below 80% — wire into CI or a release gate.

## Run it

```sh
ANTHROPIC_API_KEY=sk-ant-... npm run eval
```

Optional: choose a different model.

```sh
AGENTIC_BOOKKEEPER_MODEL=claude-sonnet-4-6 npm run eval
```

## Why two accuracy figures?

Some transactions have a single canonical answer ("ABSA RENT" → 6200 Rent Expense). Others legitimately admit multiple correct codes:

- A coffee importer's green-bean purchase could go to Direct Materials (5300) as expense or Raw Materials (1131) as capitalised inventory.
- A conference booking at a hotel could be Travel & Entertainment (6900) for the venue or Training & Development (6160) for the conference itself.

Strict accuracy penalises these as misses; tolerant accuracy credits them. Both numbers matter — strict tracks "does it match the bookkeeper's preferred answer?", tolerant tracks "is it making a defensible choice?".

## Extending the dataset

When adding new entries, prefer cases that:

1. Stress one of the prompt's encoded SA rules (director loans, fuel forecourts, dividends, Section 18A donations, etc.)
2. Were misclassified in past runs of the production system at Axiomatics
3. Have ≥ 2 defensible answers (use the `acceptable` list)

Avoid pure keyword-matching cases — they bloat the dataset without exercising the reasoning surface.
