/**
 * CLI demo for agentic-bookkeeper.
 *
 * Loads examples/sample-transactions.json, categorises each transaction
 * against the SA Pty Ltd Chart of Accounts, prints a results table, and
 * reports total token usage and cost.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run example
 *
 * The first transaction pays the cache_write premium for both system blocks
 * (rules + accounts list, ~5–6k tokens combined). Every subsequent
 * transaction pays the cache_read rate (~10% of input price), so the
 * marginal cost drops sharply after the first call. Watch the cache_read
 * counter climb in the summary.
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
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SampleFileSchema = z.object({
  company: z.string(),
  currency: z.string(),
  note: z.string(),
  transactions: z.array(TransactionSchema.extend({ id: z.string() })),
});

interface Totals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMicroCents: number;
  successes: number;
  failures: number;
}

const COL = {
  id: 6,
  desc: 36,
  amount: 12,
  code: 6,
  account: 32,
  conf: 6,
} as const;

async function main(): Promise<void> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey.length === 0) {
    console.error("✗ ANTHROPIC_API_KEY env var is required.");
    console.error("  Get a key at https://console.anthropic.com/settings/keys");
    console.error("  Then run: ANTHROPIC_API_KEY=sk-ant-... npm run example");
    process.exit(1);
  }

  const dataPath = resolve(__dirname, "sample-transactions.json");
  const fileContents = readFileSync(dataPath, "utf-8");
  const parsed: unknown = JSON.parse(fileContents);
  const data = SampleFileSchema.parse(parsed);

  console.log(`agentic-bookkeeper — example`);
  console.log(`Company:   ${data.company}`);
  console.log(`Note:      ${data.note}`);
  console.log(`Categorising ${String(data.transactions.length)} transactions...\n`);

  const provider = new AnthropicProvider({ apiKey });

  const totals: Totals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicroCents: 0,
    successes: 0,
    failures: 0,
  };

  printHeader();
  const startMs = Date.now();

  for (const tx of data.transactions) {
    const result = await categorize({
      transaction: tx,
      provider,
      observer: {
        onTokens: (usage) => {
          totals.inputTokens += usage.inputTokens;
          totals.outputTokens += usage.outputTokens;
          totals.cacheReadTokens += usage.cacheReadInputTokens ?? 0;
          totals.cacheWriteTokens += usage.cacheCreationInputTokens ?? 0;
        },
        onCost: (microCents) => {
          totals.costMicroCents += microCents;
        },
      },
    });

    if (result.ok) {
      totals.successes += 1;
      printRow(
        tx.id,
        tx.description,
        formatAmount(tx.amount),
        result.value.accountCode,
        result.value.accountName,
        result.value.confidence.toFixed(2),
      );
    } else {
      totals.failures += 1;
      printRow(tx.id, tx.description, formatAmount(tx.amount), "ERR", result.error.kind, "");
    }
  }

  const elapsedMs = Date.now() - startMs;

  printDivider();
  console.log(`\nSummary`);
  console.log(
    `  Categorised: ${String(totals.successes)}/${String(data.transactions.length)} successful`,
  );
  if (totals.failures > 0) {
    console.log(`  Failures:    ${String(totals.failures)}`);
  }
  console.log(
    `  Tokens:      ${totals.inputTokens.toLocaleString("en-ZA")} input / ${totals.outputTokens.toLocaleString("en-ZA")} output`,
  );
  console.log(
    `  Cache:       ${totals.cacheReadTokens.toLocaleString("en-ZA")} read, ${totals.cacheWriteTokens.toLocaleString("en-ZA")} write`,
  );
  console.log(`  Cost:        $${microCentsToDollars(totals.costMicroCents).toFixed(4)} USD`);
  console.log(
    `  Avg / tx:    $${microCentsToDollars(totals.costMicroCents / data.transactions.length).toFixed(4)} USD`,
  );
  console.log(`  Wall-clock:  ${(elapsedMs / 1000).toFixed(1)}s`);
}

function printHeader(): void {
  printRow("ID", "Description", "Amount", "Code", "Account", "Conf");
  printDivider();
}

function printDivider(): void {
  const total = COL.id + COL.desc + COL.amount + COL.code + COL.account + COL.conf + 5 * 3;
  console.log("─".repeat(total));
}

function printRow(
  id: string,
  desc: string,
  amount: string,
  code: string,
  account: string,
  conf: string,
): void {
  const cells = [
    id.padEnd(COL.id),
    truncate(desc, COL.desc).padEnd(COL.desc),
    amount.padStart(COL.amount),
    code.padEnd(COL.code),
    truncate(account, COL.account).padEnd(COL.account),
    conf.padStart(COL.conf),
  ];
  console.log(cells.join(" │ "));
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatAmount(amount: number): string {
  const sign = amount < 0 ? "-" : "+";
  return `${sign}R${Math.abs(amount).toLocaleString("en-ZA")}`;
}

main().catch((error: unknown) => {
  console.error("\n✗ Fatal error:", error);
  process.exit(1);
});
