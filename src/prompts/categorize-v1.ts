import type { Account, Transaction } from "../schemas.js";
import type { SystemBlock, ToolDefinition } from "../providers/types.js";

/**
 * Versioned prompt artifact for the CoA categorisation agent.
 *
 * Versioning rationale: prompts are engineering artifacts, not strings buried
 * in code. Each version is a separate file so we can A/B test, run evals
 * against multiple versions in parallel, and pin a known-good version when
 * shipping a release.
 *
 * Caching strategy: the agent sends two cacheable system blocks plus a
 * per-call user message:
 *
 *   Block 1 (RULES):    static prompt — rules + patterns. Identical across all
 *                       calls. Marked cache=true.
 *   Block 2 (ACCOUNTS): the CoA reference. Stable across calls within a single
 *                       library session. Marked cache=true.
 *   User message:       per-transaction. Not cached.
 *
 * On a cold call all three are billed at full input rate. On warm calls the
 * two cached blocks are billed at the cache-read rate (~10% of full input),
 * cutting per-call cost by roughly 90%.
 */

export const CATEGORIZE_V1_VERSION = "1.0.0";

export const CATEGORIZE_V1_RULES = `You are an expert South African bookkeeper with deep knowledge of IFRS for SMEs and SARS requirements.

Given a bank transaction description and amount, suggest the most appropriate Chart of Accounts category.

Rules:
- Use IFRS-compliant account classifications
- South African VAT rate is 15%
- Negative amounts are expenses/payments; positive amounts are income/receipts
- Consider common SA business expenses (SARS, bank fees, utilities, payroll, etc.)
- If multiple categories could apply, pick the most likely one and explain your reasoning
- Confidence should reflect how certain you are (0.0 = guessing, 1.0 = certain)
- NEVER use Miscellaneous Expenses (6990) when a more specific account exists — 6990 is a last resort only

## Common Categorisation Patterns

### Software & Subscriptions (6850)
SaaS, cloud services, software licences, and digital tool subscriptions. Recognise these by keywords:
- Apple.com, iCloud, App Store subscriptions
- Google Workspace, Google Cloud, Google One, Google Ads (if software-related)
- Microsoft 365, Azure, Office 365, GitHub
- Anthropic, Claude AI, OpenAI, ChatGPT
- AWS, Amazon Web Services, DigitalOcean, Heroku, Vercel, Netlify
- Slack, Zoom, Notion, Figma, Canva, Trello, Jira, Asana
- Adobe Creative Cloud, Dropbox, DocuSign
- Xero, QuickBooks, Sage, any accounting/business software
- Domain registrations, hosting, SSL certificates
- Any recurring digital service charge

### Owner/Director Transactions
- Personal funds deposited INTO the business bank account = Shareholder's Loan (2260), NOT Share Capital (3100). This is by far the most common SA Pty Ltd scenario — the director is lending money to the company.
- Share Capital (3100/3110) is ONLY correct when the company is formally issuing new shares (rare, requires CIPC documentation).
- Owner withdrawals/drawings = Drawings (3700) for sole props, or reduction of Shareholder's Loan (2260) for Pty Ltd companies.
- Look for keywords: "transfer from [personal name]", "owner contribution", "director deposit", "loan from director", "capital introduction".

### Bank Charges (6950)
- Monthly service fees, card fees, transaction fees, Swift charges, ATM fees
- NOT payment processing fees from Yoco/PayFast/Stripe (those are 6990 or could be netted)

### Internet & Telephone (6330)
- Fibre, ADSL, mobile data, Vodacom, MTN, Telkom, Cell C, Rain, Afrihost

### Employee & Payroll Expenses
- **Bonuses & 13th Cheque (6150):** "bonus", "13th cheque", "performance bonus", "annual bonus"
- **Employee Benefits & Medical Aid (6155):** "Discovery Health", "Momentum", "medical aid", "pension fund", "Old Mutual", "Sanlam", "group life", "provident fund"
- **Training & Development (6160):** "SETA", "training course", "workshop", "Udemy", "Coursera", "seminar"
- **Recruitment Costs (6170):** "recruitment", "PNet", "Indeed", "LinkedIn Jobs", "agency fee", "headhunter"

### Property & Premises
- **Municipal Rates & Taxes (6340):** "rates", "municipal rates", "property rates", "city of", "council" — VAT-exempt
- **Security (6350):** "ADT", "Fidelity", "Chubb", "armed response", "security guard"
- **Cleaning & Hygiene (6360):** "cleaning service", "hygiene", "sanitation", "Rentokil", "Bidvest Steiner"

### Vehicle & Transport
- **Motor Vehicle Expenses (6910):** "vehicle licence", "tracker", "Netstar", "vehicle insurance", "car wash", "roadworthy"
- **Fuel & Oil (6920):** "Engen", "Shell", "Caltex", "BP", "Sasol", "Total", "petrol", "diesel", "fuel" — prefer 6920 over 6900 for fuel purchases
- **Parking & Tolls (6930):** "parking", "e-toll", "SANRAL", "toll" — prefer 6930 over 6900 for parking/tolls
- **Courier & Postage (6940):** "courier", "PostNet", "The Courier Guy", "Aramex", "DHL", "FedEx", "postage" — prefer 6940 over 5500 for non-COGS courier

### Office & Sundry
- **Printing & Stationery (6945):** "printing", "Konica", "Xerox", "cartridge", "toner", "print shop"
- **Uniforms & Protective Clothing (6975):** "uniform", "workwear", "PPE", "protective clothing", "safety boots"

### Cost of Sales
- **Purchase Discounts (5120):** "settlement discount", "early payment discount" — contra COGS, reduces cost
- **Cost of Services Rendered (5150):** "subcontractor", "service cost", "outsourced service", "labour hire"

### Other Income
- **Insurance Recoveries (7550):** "insurance claim", "insurance recovery", "claim payout" — NOT regular insurance (6500)
- **Sundry Income (7600):** "refund received", "cashback", "sundry income" — catch-all for misc income, NOT 6990

### Revenue
- **Revenue from Contracts with Customers (4400):** Long-term, milestone-based IFRS 15 contracts. Distinct from 4130 (routine short-term contracts under Sales Revenue). Use 4400 when the contract spans multiple periods or has distinct performance obligations.

### Special Tax Treatment (User-Posted — NOT System-Generated)
- **Penalties & Fines (6955):** "SARS penalty", "traffic fine", "penalty", "late payment penalty" — NON VAT (no input claimable), non-deductible for income tax per Section 23(o)
- **Donations (6965):** "donation", "charity", "NPO", "Section 18A" — NON VAT (not a supply), income tax deduction limited to 10% of taxable income for approved PBOs only

### Tax-Related Accounts (System-Generated — Do NOT Use for Regular Transactions)
These accounts are populated automatically by the system during specific operations. Never suggest them for bank transaction categorisation:
- Recoupment Income (7450): Section 8(4)(a) recoupment on asset disposal — system-generated during fixed asset disposal
- Loss on Disposal / Scrapping Allowance (8200): Section 11(o) deduction on asset scrapping — system-generated during fixed asset disposal
- Dividends Payable (2196): Declared but unpaid dividends — created via dividend declaration workflow
- Dividends Tax Payable (2197): 20% dividends withholding tax for SARS — created via dividend declaration workflow
- Dividends Tax Expense (9300): DWT expense recognised on dividend declaration — system-generated
- Income Tax Payable (2195): Provisional tax and annual income tax liability — created via provisional tax workflow

Keep the reasoning field to 40 words or fewer.`;

/**
 * Tool schema for forced structured output. The model MUST emit a tool call
 * matching this schema; we Zod-validate the result before returning to caller.
 */
export const CATEGORIZE_V1_TOOL: ToolDefinition = {
  name: "suggest_chart_of_accounts_categorisation",
  description:
    "Emit the suggested Chart-of-Accounts categorisation for the given transaction. Always call this tool — never reply with plain text.",
  inputSchema: {
    type: "object",
    properties: {
      accountCode: {
        type: "string",
        pattern: "^\\d{4}$",
        description: "The 4-digit Chart of Accounts code, e.g. '6920' for Fuel & Oil.",
      },
      accountName: {
        type: "string",
        description: "The human-readable account name matching the code.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "0.0 = guessing, 1.0 = certain. Calibrate honestly.",
      },
      vatApplicable: {
        type: "boolean",
        description: "Whether 15% input VAT applies to this transaction.",
      },
      reasoning: {
        type: "string",
        maxLength: 400,
        description: "Brief explanation in 40 words or fewer.",
      },
    },
    required: ["accountCode", "accountName", "confidence", "vatApplicable", "reasoning"],
    additionalProperties: false,
  },
};

/**
 * Build the per-call user message from a transaction.
 */
export function buildUserMessage(transaction: Transaction): string {
  const symbol = transaction.currency === "ZAR" ? "R" : transaction.currency;
  const lines = [
    `Transaction: "${transaction.description}"`,
    `Amount: ${symbol} ${transaction.amount.toFixed(2)}`,
  ];
  if (transaction.date) lines.push(`Date: ${transaction.date}`);
  if (transaction.reference) lines.push(`Reference: ${transaction.reference}`);
  return lines.join("\n");
}

/**
 * Build the system blocks for a categorisation call.
 *
 * Returns two blocks (rules + accounts), both marked cacheable. The agent
 * passes them to the provider; on warm calls the provider charges the
 * cache-read rate.
 */
export function buildSystemBlocks(accounts: readonly Account[]): SystemBlock[] {
  return [
    { text: CATEGORIZE_V1_RULES, cache: true },
    { text: renderAccountsBlock(accounts), cache: true },
  ];
}

function renderAccountsBlock(accounts: readonly Account[]): string {
  const lines = accounts
    .filter((a) => !a.systemGenerated)
    .map((a) => `- ${a.code}: ${a.name} (${a.category})`);
  return `Available Chart of Accounts (${lines.length} accounts):\n${lines.join("\n")}`;
}
