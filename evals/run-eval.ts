/**
 * Evaluation harness for agentic-bookkeeper.
 *
 * Runs `categorize()` against evals/dataset.json (25 labelled SA-specific
 * transactions) and reports two accuracy figures:
 *
 *   Strict     = % matching the labelled `primary` code exactly.
 *   Tolerant   = % matching any code in the `acceptable` list (covers cases
 *                where multiple codes are defensibly correct, e.g. Indaba
 *                conference → 6160 Training OR 6900 Travel).
 *
 * Misses are listed individually with the model's choice + reasoning so you
 * can decide whether the prompt needs tightening, the dataset needs
 * relabelling, or the model is genuinely wrong.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run eval
 *
 * Optional env:
 *   AGENTIC_BOOKKEEPER_MODEL=claude-sonnet-4-6  (defaults to claude-haiku-4-5)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  AnthropicProvider,
  TransactionSchema,
  categorize,
  microCentsToDollars,
  type CategorizationResult,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DatasetSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  synthetic: z.literal(true),
  currency: z.string(),
  entries: z.array(
    z.object({
      id: z.string(),
      transaction: TransactionSchema,
      expected: z.object({
        primary: z.string().regex(/^\d{4}$/),
        acceptable: z.array(z.string().regex(/^\d{4}$/)).min(1),
      }),
      rationale: z.string(),
    }),
  ),
});

interface Miss {
  id: string;
  description: string;
  expectedPrimary: string;
  acceptable: readonly string[];
  got: CategorizationResult | null;
  errorKind?: string;
}

async function main(): Promise<void> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey.length === 0) {
    console.error("✗ ANTHROPIC_API_KEY env var is required.");
    process.exit(1);
  }
  const model = process.env["AGENTIC_BOOKKEEPER_MODEL"] ?? "claude-haiku-4-5";

  const dataPath = resolve(__dirname, "dataset.json");
  const dataset = DatasetSchema.parse(JSON.parse(readFileSync(dataPath, "utf-8")));

  console.log(`agentic-bookkeeper — eval`);
  console.log(`Dataset:  ${dataset.name} v${dataset.version}`);
  console.log(`Entries:  ${String(dataset.entries.length)}`);
  console.log(`Model:    ${model}\n`);

  const provider = new AnthropicProvider({ apiKey });

  let strictHits = 0;
  let tolerantHits = 0;
  const misses: Miss[] = [];
  let totalCostMicroCents = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;

  const startMs = Date.now();

  for (const entry of dataset.entries) {
    process.stdout.write(`  ${entry.id}…  `);

    const result = await categorize({
      transaction: entry.transaction,
      provider,
      model,
      observer: {
        onTokens: (usage) => {
          totalInputTokens += usage.inputTokens;
          totalOutputTokens += usage.outputTokens;
          totalCacheReadTokens += usage.cacheReadInputTokens ?? 0;
          totalCacheWriteTokens += usage.cacheCreationInputTokens ?? 0;
        },
        onCost: (microCents) => {
          totalCostMicroCents += microCents;
        },
      },
    });

    if (!result.ok) {
      misses.push({
        id: entry.id,
        description: entry.transaction.description,
        expectedPrimary: entry.expected.primary,
        acceptable: entry.expected.acceptable,
        got: null,
        errorKind: result.error.kind,
      });
      console.log(`✗  ${result.error.kind}`);
      continue;
    }

    const code = result.value.accountCode;
    const matchedPrimary = code === entry.expected.primary;
    const matchedAcceptable = entry.expected.acceptable.includes(code);

    if (matchedPrimary) strictHits += 1;
    if (matchedAcceptable) tolerantHits += 1;

    if (matchedAcceptable) {
      const tag = matchedPrimary ? "✓" : "≈";
      console.log(`${tag}  ${code} (${result.value.confidence.toFixed(2)})`);
    } else {
      misses.push({
        id: entry.id,
        description: entry.transaction.description,
        expectedPrimary: entry.expected.primary,
        acceptable: entry.expected.acceptable,
        got: result.value,
      });
      console.log(`✗  got ${code} expected ${entry.expected.primary}`);
    }
  }

  const elapsedMs = Date.now() - startMs;
  const total = dataset.entries.length;

  console.log(`\n${"─".repeat(72)}`);
  console.log(`Results`);
  console.log(
    `  Strict   : ${String(strictHits)}/${String(total)} = ${pct(strictHits, total)}  (matched primary code exactly)`,
  );
  console.log(
    `  Tolerant : ${String(tolerantHits)}/${String(total)} = ${pct(tolerantHits, total)}  (matched primary or accepted alternate)`,
  );

  if (misses.length > 0) {
    console.log(`\nMisses (${String(misses.length)})`);
    for (const miss of misses) {
      console.log(`\n  ${miss.id}: ${miss.description}`);
      console.log(
        `    expected: ${miss.expectedPrimary} (acceptable: ${miss.acceptable.join(", ")})`,
      );
      if (miss.got) {
        console.log(
          `    got:      ${miss.got.accountCode} (conf=${miss.got.confidence.toFixed(2)})`,
        );
        console.log(`    reasoning: ${miss.got.reasoning}`);
      } else {
        console.log(`    error:    ${miss.errorKind ?? "unknown"}`);
      }
    }
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log(`Telemetry`);
  console.log(
    `  Tokens     : ${totalInputTokens.toLocaleString("en-ZA")} input / ${totalOutputTokens.toLocaleString("en-ZA")} output`,
  );
  console.log(
    `  Cache      : ${totalCacheReadTokens.toLocaleString("en-ZA")} read, ${totalCacheWriteTokens.toLocaleString("en-ZA")} write`,
  );
  console.log(`  Cost       : $${microCentsToDollars(totalCostMicroCents).toFixed(4)} USD`);
  console.log(`  Avg / tx   : $${microCentsToDollars(totalCostMicroCents / total).toFixed(4)} USD`);
  console.log(`  Wall-clock : ${(elapsedMs / 1000).toFixed(1)}s`);

  const PASS_THRESHOLD = 0.8;
  if (tolerantHits / total < PASS_THRESHOLD) {
    console.log(
      `\n✗ Tolerant accuracy ${pct(tolerantHits, total)} below pass threshold ${(PASS_THRESHOLD * 100).toFixed(0)}%.`,
    );
    process.exit(1);
  }
  console.log(
    `\n✓ Tolerant accuracy meets pass threshold (≥ ${(PASS_THRESHOLD * 100).toFixed(0)}%).`,
  );
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "0.0%";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

main().catch((error: unknown) => {
  console.error("\n✗ Fatal error:", error);
  process.exit(1);
});
