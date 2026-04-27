import type { Account } from "../schemas.js";

/**
 * Reference Chart of Accounts for a South African private company (Pty Ltd),
 * IFRS-aligned and SARS-compatible.
 *
 * Scope: postable accounts only. Hierarchy aggregators (e.g. "Current Assets"
 * 1100, "Sales Revenue" 4100) are deliberately excluded — the agent should
 * never post a transaction to a category rollup.
 *
 * `vatApplicable` is derived from the production tax-code mapping:
 *   STD (15% standard-rated) → true
 *   EXM (exempt) / NON (non-VATable) / null → false
 *
 * `systemGenerated: true` flags accounts the agent must NEVER suggest. These
 * are populated by other workflows (asset disposal, dividend declaration,
 * provisional tax) and posting to them out-of-band would corrupt the books.
 */

const A = (
  code: string,
  name: string,
  category: Account["category"],
  vatApplicable: boolean,
  options: { systemGenerated?: boolean; subcategory?: string } = {},
): Account => {
  const base = { code, name, category, vatApplicable };
  return {
    ...base,
    ...(options.systemGenerated !== undefined ? { systemGenerated: options.systemGenerated } : {}),
    ...(options.subcategory !== undefined ? { subcategory: options.subcategory } : {}),
  } as Account;
};

export const SA_PTY_COA: readonly Account[] = [
  // ─── ASSETS — Current ────────────────────────────────────
  A("1111", "Petty Cash", "ASSET", false, { subcategory: "Cash" }),
  A("1112", "Bank - Current Account", "ASSET", false, { subcategory: "Cash" }),
  A("1113", "Bank - Savings Account", "ASSET", false, { subcategory: "Cash" }),
  A("1114", "Bank - Credit Card", "ASSET", false, { subcategory: "Cash" }),
  A("1121", "Trade Receivables", "ASSET", false, { subcategory: "Receivables" }),
  A("1122", "Allowance for Doubtful Debts", "ASSET", false, { subcategory: "Receivables" }),
  A("1123", "Other Receivables", "ASSET", false, { subcategory: "Receivables" }),
  A("1131", "Raw Materials", "ASSET", false, { subcategory: "Inventory" }),
  A("1132", "Work in Progress", "ASSET", false, { subcategory: "Inventory" }),
  A("1133", "Finished Goods", "ASSET", false, { subcategory: "Inventory" }),
  A("1134", "Inventory Write-Down Allowance", "ASSET", false, { subcategory: "Inventory" }),
  A("1141", "Prepaid Insurance", "ASSET", false, { subcategory: "Prepayments" }),
  A("1142", "Prepaid Rent", "ASSET", false, { subcategory: "Prepayments" }),
  A("1143", "Other Prepayments", "ASSET", false, { subcategory: "Prepayments" }),
  A("1150", "VAT Input", "ASSET", true, { subcategory: "Tax" }),
  A("1160", "Short-term Investments", "ASSET", false, { subcategory: "Investments" }),
  A("1170", "Deposits", "ASSET", false, { subcategory: "Other" }),
  A("1180", "Accrued Income", "ASSET", false, { subcategory: "Other" }),

  // ─── ASSETS — Non-Current ────────────────────────────────
  A("1211", "Land", "ASSET", false, { subcategory: "PPE" }),
  A("1212", "Buildings", "ASSET", false, { subcategory: "PPE" }),
  A("1213", "Machinery & Equipment", "ASSET", false, { subcategory: "PPE" }),
  A("1214", "Motor Vehicles", "ASSET", false, { subcategory: "PPE" }),
  A("1215", "Office Equipment", "ASSET", false, { subcategory: "PPE" }),
  A("1216", "Computer Equipment", "ASSET", false, { subcategory: "PPE" }),
  A("1217", "Furniture & Fittings", "ASSET", false, { subcategory: "PPE" }),
  A("1218", "Leasehold Improvements", "ASSET", false, { subcategory: "PPE" }),
  A("1221", "Acc. Dep. - Buildings", "ASSET", false, { subcategory: "Acc. Depreciation" }),
  A("1222", "Acc. Dep. - Machinery", "ASSET", false, { subcategory: "Acc. Depreciation" }),
  A("1223", "Acc. Dep. - Motor Vehicles", "ASSET", false, { subcategory: "Acc. Depreciation" }),
  A("1224", "Acc. Dep. - Office Equipment", "ASSET", false, { subcategory: "Acc. Depreciation" }),
  A("1225", "Acc. Dep. - Computer Equipment", "ASSET", false, { subcategory: "Acc. Depreciation" }),
  A("1226", "Acc. Dep. - Furniture & Fittings", "ASSET", false, {
    subcategory: "Acc. Depreciation",
  }),
  A("1227", "Acc. Dep. - Leasehold Improvements", "ASSET", false, {
    subcategory: "Acc. Depreciation",
  }),
  A("1231", "Goodwill", "ASSET", false, { subcategory: "Intangibles" }),
  A("1232", "Software", "ASSET", false, { subcategory: "Intangibles" }),
  A("1233", "Patents & Trademarks", "ASSET", false, { subcategory: "Intangibles" }),
  A("1234", "Accumulated Amortisation", "ASSET", false, { subcategory: "Intangibles" }),
  A("1240", "Right-of-Use Assets", "ASSET", false, { subcategory: "Leases (IFRS 16)" }),
  A("1250", "Long-term Investments", "ASSET", false, { subcategory: "Investments" }),
  A("1260", "Deferred Tax Asset", "ASSET", false, { subcategory: "Tax" }),

  // ─── LIABILITIES — Current ───────────────────────────────
  A("2110", "Accounts Payable", "LIABILITY", false, { subcategory: "Trade Creditors" }),
  A("2121", "Accrued Salaries", "LIABILITY", false, { subcategory: "Accruals" }),
  A("2122", "Accrued Interest", "LIABILITY", false, { subcategory: "Accruals" }),
  A("2123", "Other Accruals", "LIABILITY", false, { subcategory: "Accruals" }),
  A("2130", "Short-term Borrowings", "LIABILITY", false, { subcategory: "Debt" }),
  A("2140", "Current Portion of Long-term Debt", "LIABILITY", false, { subcategory: "Debt" }),
  A("2150", "VAT Output", "LIABILITY", true, { subcategory: "Tax" }),
  A("2160", "PAYE Payable", "LIABILITY", false, { subcategory: "Payroll" }),
  A("2170", "UIF Payable", "LIABILITY", false, { subcategory: "Payroll" }),
  A("2180", "SDL Payable", "LIABILITY", false, { subcategory: "Payroll" }),
  A("2190", "Provision for Leave Pay", "LIABILITY", false, { subcategory: "Payroll" }),
  A("2191", "Provision for Bonuses", "LIABILITY", false, { subcategory: "Payroll" }),
  A("2192", "Workmen's Compensation Payable", "LIABILITY", false, { subcategory: "Payroll" }),
  A("2195", "Income Tax Payable", "LIABILITY", false, {
    subcategory: "Tax",
    systemGenerated: true,
  }),
  A("2196", "Dividends Payable", "LIABILITY", false, {
    subcategory: "Equity",
    systemGenerated: true,
  }),
  A("2197", "Dividends Tax Payable", "LIABILITY", false, {
    subcategory: "Tax",
    systemGenerated: true,
  }),
  A("2199", "Other Current Liabilities", "LIABILITY", false, { subcategory: "Other" }),

  // ─── LIABILITIES — Non-Current ───────────────────────────
  A("2210", "Long-term Loans", "LIABILITY", false, { subcategory: "Debt" }),
  A("2220", "Mortgage Payable", "LIABILITY", false, { subcategory: "Debt" }),
  A("2230", "Lease Liabilities", "LIABILITY", false, { subcategory: "Leases (IFRS 16)" }),
  A("2240", "Deferred Tax Liability", "LIABILITY", false, { subcategory: "Tax" }),
  A("2250", "Provisions", "LIABILITY", false, { subcategory: "Other" }),
  A("2260", "Shareholder's Loan", "LIABILITY", false, { subcategory: "Owner Funds" }),

  // ─── EQUITY ──────────────────────────────────────────────
  A("3110", "Ordinary Shares", "EQUITY", false, { subcategory: "Share Capital" }),
  A("3120", "Preference Shares", "EQUITY", false, { subcategory: "Share Capital" }),
  A("3200", "Share Premium", "EQUITY", false),
  A("3300", "Retained Earnings", "EQUITY", false),
  A("3400", "Current Year Earnings", "EQUITY", false),
  A("3510", "Revaluation Reserve", "EQUITY", false, { subcategory: "Reserves" }),
  A("3520", "Foreign Currency Translation Reserve", "EQUITY", false, { subcategory: "Reserves" }),
  A("3530", "Other Comprehensive Income", "EQUITY", false, { subcategory: "Reserves" }),
  A("3600", "Dividends Declared", "EQUITY", false),
  A("3700", "Drawings", "EQUITY", false),

  // ─── REVENUE — Operating ─────────────────────────────────
  A("4110", "Product Sales", "REVENUE", true, { subcategory: "Sales" }),
  A("4120", "Service Revenue", "REVENUE", true, { subcategory: "Sales" }),
  A("4130", "Contract Revenue", "REVENUE", true, { subcategory: "Sales" }),
  A("4200", "Sales Returns & Allowances", "REVENUE", true, { subcategory: "Contra" }),
  A("4300", "Sales Discounts", "REVENUE", true, { subcategory: "Contra" }),
  A("4400", "Revenue from Contracts with Customers", "REVENUE", true, {
    subcategory: "IFRS 15",
  }),

  // ─── COST OF SALES ───────────────────────────────────────
  A("5110", "Inventory Write-Down", "EXPENSE", false, { subcategory: "COGS" }),
  A("5120", "Purchase Discounts", "EXPENSE", true, { subcategory: "COGS" }),
  A("5150", "Cost of Services Rendered", "EXPENSE", false, { subcategory: "COGS" }),
  A("5200", "Direct Labour", "EXPENSE", false, { subcategory: "COGS" }),
  A("5300", "Direct Materials", "EXPENSE", false, { subcategory: "COGS" }),
  A("5400", "Manufacturing Overheads", "EXPENSE", false, { subcategory: "COGS" }),
  A("5500", "Freight & Delivery Costs", "EXPENSE", true, { subcategory: "COGS" }),
  A("5600", "Purchase Returns & Allowances", "EXPENSE", true, { subcategory: "COGS" }),

  // ─── OPERATING EXPENSES — Payroll ────────────────────────
  A("6110", "Gross Salaries", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6120", "Employer PAYE Contribution", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6130", "Employer UIF Contribution", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6140", "Employer SDL Contribution", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6150", "Bonuses & 13th Cheque", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6155", "Employee Benefits & Medical Aid", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6160", "Training & Development", "EXPENSE", false, { subcategory: "Payroll" }),
  A("6170", "Recruitment Costs", "EXPENSE", false, { subcategory: "Payroll" }),

  // ─── OPERATING EXPENSES — Premises ───────────────────────
  A("6200", "Rent Expense", "EXPENSE", true, { subcategory: "Premises" }),
  A("6310", "Electricity", "EXPENSE", true, { subcategory: "Utilities" }),
  A("6320", "Water", "EXPENSE", true, { subcategory: "Utilities" }),
  A("6330", "Internet & Telephone", "EXPENSE", true, { subcategory: "Utilities" }),
  A("6340", "Municipal Rates & Taxes", "EXPENSE", false, { subcategory: "Premises" }),
  A("6350", "Security", "EXPENSE", true, { subcategory: "Premises" }),
  A("6360", "Cleaning & Hygiene", "EXPENSE", true, { subcategory: "Premises" }),

  // ─── OPERATING EXPENSES — Other ──────────────────────────
  A("6400", "Depreciation Expense", "EXPENSE", false, { subcategory: "Non-Cash" }),
  A("6410", "Amortisation Expense", "EXPENSE", false, { subcategory: "Non-Cash" }),
  A("6500", "Insurance", "EXPENSE", false, { subcategory: "Other" }),
  A("6600", "Office Supplies & Stationery", "EXPENSE", true, { subcategory: "Office" }),
  A("6710", "Accounting & Audit Fees", "EXPENSE", true, { subcategory: "Professional" }),
  A("6720", "Legal Fees", "EXPENSE", true, { subcategory: "Professional" }),
  A("6730", "Consulting Fees", "EXPENSE", true, { subcategory: "Professional" }),
  A("6800", "Marketing & Advertising", "EXPENSE", true, { subcategory: "Marketing" }),
  A("6850", "Software & Subscriptions", "EXPENSE", true, { subcategory: "IT" }),
  A("6900", "Travel & Entertainment", "EXPENSE", false, { subcategory: "Travel" }),
  A("6910", "Motor Vehicle Expenses", "EXPENSE", true, { subcategory: "Vehicle" }),
  A("6920", "Fuel & Oil", "EXPENSE", true, { subcategory: "Vehicle" }),
  A("6930", "Parking & Tolls", "EXPENSE", true, { subcategory: "Vehicle" }),
  A("6940", "Courier & Postage", "EXPENSE", true, { subcategory: "Office" }),
  A("6945", "Printing & Stationery", "EXPENSE", true, { subcategory: "Office" }),
  A("6950", "Bank Charges & Fees", "EXPENSE", false, { subcategory: "Finance" }),
  A("6955", "Penalties & Fines", "EXPENSE", false, { subcategory: "Tax" }),
  A("6960", "Bad Debts Expense", "EXPENSE", false, { subcategory: "Receivables" }),
  A("6965", "Donations", "EXPENSE", false, { subcategory: "Other" }),
  A("6970", "Repairs & Maintenance", "EXPENSE", true, { subcategory: "Premises" }),
  A("6975", "Uniforms & Protective Clothing", "EXPENSE", true, { subcategory: "Payroll" }),
  A("6980", "Inventory Loss / Shortage", "EXPENSE", false, { subcategory: "Inventory" }),
  A("6990", "Miscellaneous Expenses", "EXPENSE", true, { subcategory: "Other" }),

  // ─── OTHER INCOME ────────────────────────────────────────
  A("7100", "Interest Income", "REVENUE", false, { subcategory: "Other Income" }),
  A("7200", "Dividend Income", "REVENUE", false, { subcategory: "Other Income" }),
  A("7300", "Gain on Disposal of Assets", "REVENUE", false, { subcategory: "Other Income" }),
  A("7400", "Foreign Exchange Gains", "REVENUE", false, { subcategory: "FX" }),
  A("7450", "Recoupment Income", "REVENUE", false, {
    subcategory: "Tax",
    systemGenerated: true,
  }),
  A("7500", "Rental Income", "REVENUE", true, { subcategory: "Other Income" }),
  A("7550", "Insurance Recoveries", "REVENUE", false, { subcategory: "Other Income" }),
  A("7600", "Sundry Income", "REVENUE", false, { subcategory: "Other Income" }),

  // ─── OTHER EXPENSES ──────────────────────────────────────
  A("8100", "Interest Expense", "EXPENSE", false, { subcategory: "Finance" }),
  A("8200", "Loss on Disposal of Assets", "EXPENSE", false, {
    subcategory: "Tax",
    systemGenerated: true,
  }),
  A("8300", "Foreign Exchange Losses", "EXPENSE", false, { subcategory: "FX" }),
  A("8400", "Impairment Losses", "EXPENSE", false, { subcategory: "Non-Cash" }),
  A("8500", "Finance Costs", "EXPENSE", false, { subcategory: "Finance" }),

  // ─── TAX ─────────────────────────────────────────────────
  A("9100", "Income Tax Expense (Current)", "EXPENSE", false, { subcategory: "Tax" }),
  A("9200", "Deferred Tax Expense", "EXPENSE", false, { subcategory: "Tax" }),
  A("9300", "Dividends Tax", "EXPENSE", false, {
    subcategory: "Tax",
    systemGenerated: true,
  }),
];

/**
 * O(1) lookup by 4-digit code. Returns undefined if the code is unknown.
 */
const BY_CODE: ReadonlyMap<string, Account> = new Map(SA_PTY_COA.map((a) => [a.code, a]));

export function getAccountByCode(code: string): Account | undefined {
  return BY_CODE.get(code);
}

/**
 * Filter to accounts the agent is allowed to suggest. Excludes the
 * system-generated tax/dividend accounts that are populated by other
 * workflows (asset disposal, dividend declaration, provisional tax).
 */
export function getSuggestableAccounts(): readonly Account[] {
  return SA_PTY_COA.filter((a) => !a.systemGenerated);
}
