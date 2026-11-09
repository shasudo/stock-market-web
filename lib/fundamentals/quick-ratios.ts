/**
 * Screener-style quick ratios for the stock summary: the full tab catalog
 * (Most Used, Annual P&L, Quarter P&L, Balance Sheet, Cash Flow, Ratios,
 * Price, User Ratios) with Recent / Preceding / Historical columns.
 *
 * Every ratio resolves against EODHD metrics + annual/quarterly statements +
 * the live quote + stored daily closes. Anything our feed cannot supply
 * (promoter/FII/DII holdings, expected figures, result dates, proprietary
 * scores) resolves to null and renders as an em dash.
 */

import type { FinancialStatementPeriod, FundamentalMetrics } from "./types";

export type { FinancialStatementPeriod, FundamentalMetrics } from "./types";

export type QuickRatioTabId =
  | "most-used"
  | "annual"
  | "quarter"
  | "balance"
  | "cashflow"
  | "ratios"
  | "price"
  | "user";

export type QuickRatioColumn = "recent" | "preceding" | "historical";

export type QuickRatioUnit = "currency" | "percent" | "multiple" | "number";

export interface QuickRatioTab {
  readonly id: QuickRatioTabId;
  readonly label: string;
}

export const QUICK_RATIO_TABS: readonly QuickRatioTab[] = [
  { id: "most-used", label: "Most Used" },
  { id: "annual", label: "Annual P&L" },
  { id: "quarter", label: "Quarter P&L" },
  { id: "balance", label: "Balance Sheet" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "ratios", label: "Ratios" },
  { id: "price", label: "Price" },
  { id: "user", label: "User Ratios" },
];

export interface QuickRatioQuote {
  readonly price: number | null;
  readonly dayHigh: number | null;
  readonly dayLow: number | null;
  readonly volume: number | null;
  readonly week52High: number | null;
  readonly week52Low: number | null;
  readonly marketCap: number | null;
}

export interface PriceHistoryPoint {
  /** Unix seconds, ascending. */
  readonly ts: number;
  readonly close: number;
}

export interface QuickRatioContext {
  readonly metrics: FundamentalMetrics;
  readonly annualIncome: readonly FinancialStatementPeriod[];
  readonly annualBalance: readonly FinancialStatementPeriod[];
  readonly annualCash: readonly FinancialStatementPeriod[];
  readonly quarterlyIncome: readonly FinancialStatementPeriod[];
  readonly quarterlyBalance: readonly FinancialStatementPeriod[];
  readonly quarterlyCash: readonly FinancialStatementPeriod[];
  readonly quote: QuickRatioQuote;
  /** Daily closes, oldest first. */
  readonly history: readonly PriceHistoryPoint[];
  readonly faceValue: number | null;
}

export interface QuickRatioDef {
  readonly id: string;
  readonly label: string;
  readonly tabs: readonly QuickRatioTabId[];
  readonly column: QuickRatioColumn;
  readonly unit: QuickRatioUnit;
  readonly resolve: (ctx: QuickRatioContext) => number | null;
}

const DAY_SECONDS = 86_400;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const pos = (value: number | null | undefined): number | null =>
  value != null && value > 0 ? value : null;

const val = (
  period: FinancialStatementPeriod | undefined,
  ...names: readonly string[]
): number | null => {
  if (!period) return null;
  for (const name of names) {
    const v = num(period.values[name]);
    if (v !== null) return v;
  }
  return null;
};

const at = (
  series: readonly FinancialStatementPeriod[],
  index: number,
): FinancialStatementPeriod | undefined => series[index];

const growth = (
  current: number | null,
  previous: number | null,
): number | null => {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

/** Sum of the latest `count` quarterly values for a line item. */
const ttm = (
  quarters: readonly FinancialStatementPeriod[],
  count: number,
  ...names: readonly string[]
): number | null => {
  let total = 0;
  let seen = 0;
  for (let i = 0; i < Math.min(count, quarters.length); i += 1) {
    const v = val(quarters[i], ...names);
    if (v !== null) {
      total += v;
      seen += 1;
    }
  }
  return seen > 0 ? total : null;
};

const avg = (values: readonly (number | null)[]): number | null => {
  const finite = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (finite.length === 0) return null;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
};

const median = (values: readonly (number | null)[]): number | null => {
  const finite = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 1
    ? finite[mid]
    : (finite[mid - 1] + finite[mid]) / 2;
};

const sma = (
  closes: readonly number[],
  length: number,
  endOffset = 0,
): number | null => {
  if (closes.length < length + endOffset || length <= 0) return null;
  const end = closes.length - endOffset;
  let total = 0;
  for (let i = end - length; i < end; i += 1) total += closes[i];
  return total / length;
};

const rsi = (closes: readonly number[], length = 14): number | null => {
  if (closes.length < length + 1) return null;
  let gain = 0;
  let loss = 0;
  const start = closes.length - length;
  for (let i = start; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gain += change;
    else loss -= change;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
};

const ema = (closes: readonly number[], length: number): number[] => {
  const k = 2 / (length + 1);
  const out: number[] = [];
  let prev = closes[0];
  for (const close of closes) {
    prev = close * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};

const macdTriple = (
  closes: readonly number[],
): { macd: number; signal: number } | null => {
  if (closes.length < 35) return null;
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line = fast.map((v, i) => v - slow[i]);
  const signalLine = ema(line, 9);
  return {
    macd: line[line.length - 1],
    signal: signalLine[signalLine.length - 1],
  };
};

const closeAtOrBefore = (
  history: readonly PriceHistoryPoint[],
  target: number,
): number | null => {
  let lo = 0;
  let hi = history.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (history[mid].ts <= target) {
      best = history[mid].close;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
};

const priceAgo = (
  history: readonly PriceHistoryPoint[],
  days: number,
): number | null => {
  if (history.length === 0) return null;
  const latest = history[history.length - 1].ts;
  return closeAtOrBefore(history, latest - days * DAY_SECONDS);
};

// EODHD line-item names with fallbacks; anything absent resolves to null
// (rendered as an em dash) rather than a guessed number.
const REV = ["totalRevenue", "revenue", "sales", "totalRevenues"] as const;
const GROSS = ["grossProfit", "grossIncome"] as const;
const OP_INC = ["operatingIncome", "operatingProfit", "ebit"] as const;
const NET = ["netIncome", "netIncomeFromContinuingOps", "netProfit"] as const;
const OTHER_INC = [
  "totalOtherIncomeExpenseNet",
  "otherIncome",
  "nonOperatingIncomeNetOther",
] as const;
const EBT = ["incomeBeforeTax", "profitBeforeTax", "ebt"] as const;
const TAX = ["incomeTaxExpense", "provisionForIncomeTaxes", "tax"] as const;
const INTEREST = ["interestExpense", "financeCosts", "interest"] as const;
const DEP = [
  "depreciation",
  "depreciationAndAmortization",
  "depreciationDepletionAndAmortization",
] as const;
const MAT_COST = [
  "costOfRevenue",
  "costOfGoodsSold",
  "materialCost",
  "rawMaterialCost",
] as const;
const EMP_COST = ["employeeCost", "salariesAndWages"] as const;
const EXTRA = [
  "extraordinaryItems",
  "extraordinaryItemsNetOfTax",
  "nonRecurring",
] as const;
const DIV_PAID = [
  "dividendsPaid",
  "commonStockDividendsPaid",
  "dividendPaid",
] as const;
const DEBT = ["totalDebt", "shortLongTermDebtTotal", "debtTotal"] as const;
const EQUITY = [
  "totalStockholderEquity",
  "totalEquity",
  "stockholdersEquity",
] as const;
const CURR_A = ["totalCurrentAssets"] as const;
const CURR_L = ["totalCurrentLiabilities"] as const;
const INV = ["inventory", "inventories"] as const;
const REC = ["netReceivables", "receivables", "tradeReceivables"] as const;
const CASH = [
  "cash",
  "cashAndEquivalents",
  "cashAndCashEquivalentsAtCarryingValue",
] as const;
const PAYABLES = ["accountsPayable", "tradePayables"] as const;
const ADV_CUST = [
  "advanceFromCustomers",
  "advancesFromCustomers",
  "contractLiabilities",
  "deferredRevenue",
] as const;
const GROSS_BLOCK = [
  "grossBlock",
  "propertyPlantEquipmentGross",
  "grossPropertyPlantEquipment",
] as const;
const ACCUM_DEP = ["accumulatedDepreciation"] as const;
const NET_BLOCK = [
  "propertyPlantEquipmentNet",
  "propertyPlantAndEquipmentNet",
  "netBlock",
] as const;
const CWIP = ["capitalWorkInProgress", "constructionInProgress"] as const;
const INVEST = ["longTermInvestments", "investments"] as const;
const COMMON_CAP = ["commonStock", "equityCapital", "shareCapital"] as const;
const RETAINED = ["retainedEarnings"] as const;
const TOTAL_A = ["totalAssets"] as const;
const OCF = [
  "totalCashFromOperatingActivities",
  "operatingCashFlow",
  "netCashProvidedByOperatingActivities",
] as const;
const CAPEX = [
  "capitalExpenditure",
  "investmentsInPropertyPlantAndEquipment",
] as const;
const ICF = [
  "totalCashflowsFromInvestingActivities",
  "netCashUsedForInvestingActivites",
] as const;
const FCF_FIN = [
  "totalCashFromFinancingActivities",
  "netCashUsedProvidedByFinancingActivities",
] as const;
const NET_CHG = ["changeInCash", "netChangeInCash"] as const;
const CASH_BEG = ["cashAtBeginningOfPeriod"] as const;
const CASH_END = ["cashAtEndOfPeriod"] as const;

const ebitOf = (p: FinancialStatementPeriod | undefined): number | null =>
  val(p, ...EBT) !== null && val(p, ...INTEREST) !== null
    ? (val(p, ...EBT) as number) + (val(p, ...INTEREST) as number)
    : val(p, "ebit", ...OP_INC);

const ebitdaOf = (p: FinancialStatementPeriod | undefined): number | null => {
  const ebit = ebitOf(p);
  const dep = val(p, ...DEP);
  if (ebit !== null && dep !== null) return ebit + dep;
  return ebit;
};

const debtOf = (p: FinancialStatementPeriod | undefined): number | null => {
  const direct = val(p, ...DEBT);
  if (direct !== null) return direct;
  const shortT = val(p, "shortTermDebt");
  const longT = val(p, "longTermDebt");
  if (shortT !== null || longT !== null) return (shortT ?? 0) + (longT ?? 0);
  return null;
};

const fcfOf = (p: FinancialStatementPeriod | undefined): number | null => {
  const direct = val(p, "freeCashFlow");
  if (direct !== null) return direct;
  const ocf = val(p, ...OCF);
  const capex = val(p, ...CAPEX);
  if (ocf !== null && capex !== null) return ocf - Math.abs(capex);
  return ocf;
};

const wcOf = (p: FinancialStatementPeriod | undefined): number | null => {
  const a = val(p, ...CURR_A);
  const l = val(p, ...CURR_L);
  return a !== null && l !== null ? a - l : null;
};

const sharesOf = (ctx: QuickRatioContext): number | null =>
  pos(ctx.metrics.sharesOutstanding);

const epsAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const shares = sharesOf(ctx);
  const income = val(at(ctx.annualIncome, index), ...NET);
  return shares !== null && income !== null ? income / shares : null;
};

const roceAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const ebit = ebitOf(at(ctx.annualIncome, index));
  const equity = val(at(ctx.annualBalance, index), ...EQUITY);
  const debt = debtOf(at(ctx.annualBalance, index));
  const employed = equity !== null && debt !== null ? equity + debt : null;
  return ebit !== null && employed ? (ebit / employed) * 100 : null;
};

const roeAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const income = val(at(ctx.annualIncome, index), ...NET);
  const equity = val(at(ctx.annualBalance, index), ...EQUITY);
  return income !== null && equity ? (income / equity) * 100 : null;
};

const roaAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const income = val(at(ctx.annualIncome, index), ...NET);
  const assets = val(at(ctx.annualBalance, index), ...TOTAL_A);
  return income !== null && assets ? (income / assets) * 100 : null;
};

const opmAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const op = val(at(ctx.annualIncome, index), ...OP_INC);
  const rev = val(at(ctx.annualIncome, index), ...REV);
  return op !== null && rev ? (op / rev) * 100 : null;
};

const npmAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const income = val(at(ctx.annualIncome, index), ...NET);
  const rev = val(at(ctx.annualIncome, index), ...REV);
  return income !== null && rev ? (income / rev) * 100 : null;
};

const revAnnual = (ctx: QuickRatioContext, index: number): number | null =>
  val(at(ctx.annualIncome, index), ...REV);

const incomeAnnual = (ctx: QuickRatioContext, index: number): number | null =>
  val(at(ctx.annualIncome, index), ...NET);

const annualGrowth = (
  pick: (ctx: QuickRatioContext, index: number) => number | null,
  ctx: QuickRatioContext,
  yearsBack: number,
): number | null => growth(pick(ctx, 0), pick(ctx, yearsBack));

const medianAnnualGrowth = (
  pick: (ctx: QuickRatioContext, index: number) => number | null,
  ctx: QuickRatioContext,
  years: number,
): number | null => {
  const list: (number | null)[] = [];
  for (let i = 0; i < years; i += 1) {
    list.push(growth(pick(ctx, i), pick(ctx, i + 1)));
  }
  return median(list);
};

const avgAnnual = (
  pick: (ctx: QuickRatioContext, index: number) => number | null,
  ctx: QuickRatioContext,
  years: number,
): number | null => {
  const list: (number | null)[] = [];
  for (let i = 0; i < years; i += 1) list.push(pick(ctx, i));
  return avg(list);
};

const slugify = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Our feed has no Indian shareholding, estimate, result-date or text data. */
const unsupported = (): null => null;

interface RawDef {
  readonly label: string;
  readonly tabs: readonly QuickRatioTabId[];
  readonly column: QuickRatioColumn;
  readonly unit: QuickRatioUnit;
  readonly resolve: (ctx: QuickRatioContext) => number | null;
}

const R = (
  label: string,
  tabs: readonly QuickRatioTabId[],
  column: QuickRatioColumn,
  unit: QuickRatioUnit,
  resolve: (ctx: QuickRatioContext) => number | null,
): RawDef => ({ label, tabs, column, unit, resolve });

const salesTtm = (ctx: QuickRatioContext): number | null =>
  ctx.metrics.revenueTtm ?? ttm(ctx.quarterlyIncome, 4, ...REV);

const patTtm = (ctx: QuickRatioContext): number | null =>
  ttm(ctx.quarterlyIncome, 4, ...NET);

const opTtm = (ctx: QuickRatioContext): number | null =>
  ttm(ctx.quarterlyIncome, 4, ...OP_INC);

const salesTtmBack = (
  ctx: QuickRatioContext,
  quartersBack: number,
): number | null => {
  const back = ctx.quarterlyIncome.slice(quartersBack, quartersBack + 4);
  return ttm(back, 4, ...REV);
};

const closesOf = (ctx: QuickRatioContext): readonly number[] =>
  ctx.history.map((p) => p.close);

const returnOverSessions = (
  ctx: QuickRatioContext,
  sessions: number,
): number | null => {
  const closes = closesOf(ctx);
  if (closes.length <= sessions || ctx.quote.price === null) return null;
  const anchor = closes[closes.length - 1 - sessions];
  return anchor ? growth(ctx.quote.price, anchor) : null;
};

const returnOverDays = (
  ctx: QuickRatioContext,
  days: number,
): number | null => {
  if (ctx.quote.price === null) return null;
  const anchor = priceAgo(ctx.history, days);
  return anchor ? growth(ctx.quote.price, anchor) : null;
};

const MOST_USED: readonly RawDef[] = [
  R("Sales", ["most-used", "annual"], "recent", "currency", (ctx) =>
    salesTtm(ctx),
  ),
  R("OPM", ["most-used", "annual"], "recent", "percent", (ctx) => {
    const op = opTtm(ctx);
    const rev = salesTtm(ctx);
    if (op !== null && rev) return (op / rev) * 100;
    return ctx.metrics.operatingMarginTtm ?? null;
  }),
  R("Profit after tax", ["most-used", "annual"], "recent", "currency", (ctx) =>
    patTtm(ctx),
  ),
  R(
    "Market Capitalization",
    ["most-used", "ratios"],
    "recent",
    "currency",
    (ctx) => ctx.metrics.marketCapitalization ?? ctx.quote.marketCap,
  ),
  R(
    "Sales latest quarter",
    ["most-used", "quarter"],
    "recent",
    "currency",
    (ctx) => val(at(ctx.quarterlyIncome, 0), ...REV),
  ),
  R(
    "Profit after tax latest quarter",
    ["most-used", "quarter"],
    "recent",
    "currency",
    (ctx) => val(at(ctx.quarterlyIncome, 0), ...NET),
  ),
  R(
    "YOY Quarterly sales growth",
    ["most-used", "quarter"],
    "recent",
    "percent",
    (ctx) =>
      ctx.metrics.quarterlyRevenueGrowthYoy ??
      growth(
        val(at(ctx.quarterlyIncome, 0), ...REV),
        val(at(ctx.quarterlyIncome, 4), ...REV),
      ),
  ),
  R(
    "YOY Quarterly profit growth",
    ["most-used", "quarter"],
    "recent",
    "percent",
    (ctx) =>
      ctx.metrics.quarterlyEarningsGrowthYoy ??
      growth(
        val(at(ctx.quarterlyIncome, 0), ...NET),
        val(at(ctx.quarterlyIncome, 4), ...NET),
      ),
  ),
  R(
    "Price to Earning",
    ["most-used", "ratios"],
    "recent",
    "multiple",
    (ctx) => ctx.metrics.trailingPe ?? null,
  ),
  R(
    "Dividend yield",
    ["most-used", "ratios"],
    "recent",
    "percent",
    (ctx) => ctx.metrics.dividendYield ?? null,
  ),
  R(
    "Price to book value",
    ["most-used", "ratios"],
    "recent",
    "multiple",
    (ctx) => ctx.metrics.priceBook ?? null,
  ),
  R(
    "Return on capital employed",
    ["most-used", "annual"],
    "recent",
    "percent",
    (ctx) => roceAnnual(ctx, 0),
  ),
  R(
    "Return on assets",
    ["most-used", "ratios"],
    "recent",
    "percent",
    (ctx) => ctx.metrics.returnOnAssetsTtm ?? roaAnnual(ctx, 0),
  ),
  R("Debt to equity", ["most-used", "ratios"], "recent", "multiple", (ctx) => {
    const debt = debtOf(at(ctx.annualBalance, 0));
    const equity = val(at(ctx.annualBalance, 0), ...EQUITY);
    return debt !== null && equity ? debt / equity : null;
  }),
  R(
    "Return on equity",
    ["most-used", "ratios"],
    "recent",
    "percent",
    (ctx) => ctx.metrics.returnOnEquityTtm ?? roeAnnual(ctx, 0),
  ),
  R(
    "EPS",
    ["most-used", "annual"],
    "recent",
    "currency",
    (ctx) =>
      ctx.metrics.dilutedEpsTtm ??
      ctx.metrics.earningsPerShare ??
      epsAnnual(ctx, 0),
  ),
  R("Debt", ["most-used", "balance"], "recent", "currency", (ctx) =>
    debtOf(at(ctx.annualBalance, 0)),
  ),
  R(
    "Promoter holding",
    ["most-used", "annual", "ratios"],
    "recent",
    "percent",
    unsupported,
  ),
  R(
    "Change in promoter holding",
    ["most-used", "annual"],
    "recent",
    "percent",
    unsupported,
  ),
  R("Earnings yield", ["most-used", "ratios"], "recent", "percent", (ctx) => {
    const eps = ctx.metrics.dilutedEpsTtm ?? ctx.metrics.earningsPerShare;
    return eps != null && ctx.quote.price
      ? (eps / ctx.quote.price) * 100
      : null;
  }),
  R(
    "Pledged percentage",
    ["most-used", "ratios"],
    "recent",
    "percent",
    unsupported,
  ),
  R("Industry PE", ["most-used", "ratios"], "recent", "multiple", unsupported),
  R(
    "Sales growth",
    ["most-used", "quarter"],
    "recent",
    "percent",
    (ctx) =>
      growth(salesTtm(ctx), salesTtmBack(ctx, 4)) ??
      ctx.metrics.quarterlyRevenueGrowthYoy ??
      null,
  ),
  R("Profit growth", ["most-used", "quarter"], "recent", "percent", (ctx) => {
    const back = ttm(ctx.quarterlyIncome.slice(4, 8), 4, ...NET);
    return growth(patTtm(ctx), back);
  }),
  R(
    "Current price",
    ["most-used", "price"],
    "recent",
    "currency",
    (ctx) => ctx.quote.price,
  ),
  R(
    "Price to Sales",
    ["most-used", "user"],
    "recent",
    "multiple",
    (ctx) => ctx.metrics.priceSales ?? null,
  ),
  R(
    "Price to Free Cash Flow",
    ["most-used", "user"],
    "recent",
    "multiple",
    (ctx) => {
      const fcf = fcfOf(at(ctx.annualCash, 0));
      const shares = sharesOf(ctx);
      return fcf !== null && shares !== null && ctx.quote.price && fcf !== 0
        ? ctx.quote.price / (fcf / shares)
        : null;
    },
  ),
  R(
    "EVEBITDA",
    ["most-used", "user"],
    "recent",
    "multiple",
    (ctx) => ctx.metrics.enterpriseValueEbitda ?? null,
  ),
  R(
    "Enterprise Value",
    ["most-used", "ratios"],
    "recent",
    "currency",
    (ctx) => ctx.metrics.enterpriseValue ?? null,
  ),
  R("Current ratio", ["most-used", "user"], "recent", "multiple", (ctx) => {
    const a = val(at(ctx.annualBalance, 0), ...CURR_A);
    const l = val(at(ctx.annualBalance, 0), ...CURR_L);
    return a !== null && l ? a / l : null;
  }),
  R(
    "Interest Coverage Ratio",
    ["most-used", "user"],
    "recent",
    "multiple",
    (ctx) => {
      const ebit = ebitOf(at(ctx.annualIncome, 0));
      const interest = val(at(ctx.annualIncome, 0), ...INTEREST);
      return ebit !== null && interest ? ebit / interest : null;
    },
  ),
  R(
    "PEG Ratio",
    ["most-used", "user"],
    "recent",
    "multiple",
    (ctx) => ctx.metrics.pegRatio ?? null,
  ),
  R("Return over 3months", ["most-used", "price"], "recent", "percent", (ctx) =>
    returnOverDays(ctx, 92),
  ),
  R("Return over 6months", ["most-used", "price"], "recent", "percent", (ctx) =>
    returnOverDays(ctx, 183),
  ),
  R(
    "Sales growth 3Years",
    ["most-used", "annual"],
    "historical",
    "percent",
    (ctx) => annualGrowth(revAnnual, ctx, 3),
  ),
  R(
    "Sales growth 5Years",
    ["most-used", "annual"],
    "historical",
    "percent",
    (ctx) => annualGrowth(revAnnual, ctx, 5),
  ),
  R(
    "Profit growth 3Years",
    ["most-used", "annual"],
    "historical",
    "percent",
    (ctx) => annualGrowth(incomeAnnual, ctx, 3),
  ),
  R(
    "Profit growth 5Years",
    ["most-used", "annual"],
    "historical",
    "percent",
    (ctx) => annualGrowth(incomeAnnual, ctx, 5),
  ),
  R(
    "Average return on equity 5Years",
    ["most-used", "ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roeAnnual, ctx, 5),
  ),
  R(
    "Average return on equity 3Years",
    ["most-used", "ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roeAnnual, ctx, 3),
  ),
  R(
    "Return over 1year",
    ["most-used", "price"],
    "historical",
    "percent",
    (ctx) => returnOverDays(ctx, 365),
  ),
  R(
    "Return over 3years",
    ["most-used", "price"],
    "historical",
    "percent",
    (ctx) => returnOverDays(ctx, 3 * 365),
  ),
  R(
    "Return over 5years",
    ["most-used", "price"],
    "historical",
    "percent",
    (ctx) => returnOverDays(ctx, 5 * 365),
  ),
];

const ANNUAL_RECENT: readonly RawDef[] = [
  R("Sales last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...REV),
  ),
  R("Operating profit last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...OP_INC),
  ),
  R("Other income last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...OTHER_INC),
  ),
  R("EBIDT last year", ["annual"], "recent", "currency", (ctx) =>
    ebitdaOf(at(ctx.annualIncome, 0)),
  ),
  R("Depreciation last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...DEP),
  ),
  R("EBIT last year", ["annual"], "recent", "currency", (ctx) =>
    ebitOf(at(ctx.annualIncome, 0)),
  ),
  R("Interest last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...INTEREST),
  ),
  R("Profit before tax last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...EBT),
  ),
  R("Tax last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...TAX),
  ),
  R("Profit after tax last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...NET),
  ),
  R("Extraordinary items last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...EXTRA),
  ),
  R("Net Profit last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...NET),
  ),
  R("Dividend last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualCash, 0), ...DIV_PAID),
  ),
  R("Material cost last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...MAT_COST),
  ),
  R("Employee cost last year", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...EMP_COST),
  ),
  R("OPM last year", ["annual"], "recent", "percent", (ctx) =>
    opmAnnual(ctx, 0),
  ),
  R("NPM last year", ["annual"], "recent", "percent", (ctx) =>
    npmAnnual(ctx, 0),
  ),
  R("Operating profit", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...OP_INC),
  ),
  R("Interest", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...INTEREST),
  ),
  R("Depreciation", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...DEP),
  ),
  R("EPS last year", ["annual"], "recent", "currency", (ctx) =>
    epsAnnual(ctx, 0),
  ),
  R("EBIT", ["annual"], "recent", "currency", (ctx) =>
    ebitOf(at(ctx.annualIncome, 0)),
  ),
  R("Net profit", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...NET),
  ),
  R("Current Tax", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), "currentTax", ...TAX),
  ),
  R("Tax", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...TAX),
  ),
  R("Other income", ["annual"], "recent", "currency", (ctx) =>
    val(at(ctx.annualIncome, 0), ...OTHER_INC),
  ),
];

const ANNUAL_PRECEDING: readonly RawDef[] = [
  R("Sales preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualIncome, 1), ...REV),
  ),
  R(
    "Operating profit preceding year",
    ["annual"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualIncome, 1), ...OP_INC),
  ),
  R("Other income preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualIncome, 1), ...OTHER_INC),
  ),
  R("EBIDT preceding year", ["annual"], "preceding", "currency", (ctx) =>
    ebitdaOf(at(ctx.annualIncome, 1)),
  ),
  R("Depreciation preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualIncome, 1), ...DEP),
  ),
  R("EBIT preceding year", ["annual"], "preceding", "currency", (ctx) =>
    ebitOf(at(ctx.annualIncome, 1)),
  ),
  R("Interest preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualIncome, 1), ...INTEREST),
  ),
  R(
    "Profit before tax preceding year",
    ["annual"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualIncome, 1), ...EBT),
  ),
  R("Tax preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualIncome, 1), ...TAX),
  ),
  R(
    "Profit after tax preceding year",
    ["annual"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualIncome, 1), ...NET),
  ),
  R(
    "Extraordinary items preceding year",
    ["annual"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualIncome, 1), ...EXTRA),
  ),
  R("Net Profit preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualIncome, 1), ...NET),
  ),
  R("Dividend preceding year", ["annual"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualCash, 1), ...DIV_PAID),
  ),
  R("OPM preceding year", ["annual"], "preceding", "percent", (ctx) =>
    opmAnnual(ctx, 1),
  ),
  R("NPM preceding year", ["annual"], "preceding", "percent", (ctx) =>
    npmAnnual(ctx, 1),
  ),
  R("EPS preceding year", ["annual"], "preceding", "currency", (ctx) =>
    epsAnnual(ctx, 1),
  ),
  R("Sales preceding 12months", ["annual"], "preceding", "currency", (ctx) =>
    ttm(ctx.quarterlyIncome.slice(1, 5), 4, ...REV),
  ),
  R(
    "Net profit preceding 12months",
    ["annual"],
    "preceding",
    "currency",
    (ctx) => ttm(ctx.quarterlyIncome.slice(1, 5), 4, ...NET),
  ),
];

const ebitdaAnnual = (ctx: QuickRatioContext, index: number): number | null =>
  ebitdaOf(at(ctx.annualIncome, index));

const ANNUAL_HISTORICAL: readonly RawDef[] = [
  R("Sales TTM 1year back", ["annual"], "historical", "currency", (ctx) =>
    salesTtmBack(ctx, 4),
  ),
  R("Sales growth 10years median", ["annual"], "historical", "percent", (ctx) =>
    medianAnnualGrowth(revAnnual, ctx, 10),
  ),
  R("Sales growth 5years median", ["annual"], "historical", "percent", (ctx) =>
    medianAnnualGrowth(revAnnual, ctx, 5),
  ),
  R("Sales growth 7Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(revAnnual, ctx, 7),
  ),
  R("Sales growth 10Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(revAnnual, ctx, 10),
  ),
  R("EBIDT growth 3Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(ebitdaAnnual, ctx, 3),
  ),
  R("EBIDT growth 5Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(ebitdaAnnual, ctx, 5),
  ),
  R("EBIDT growth 7Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(ebitdaAnnual, ctx, 7),
  ),
  R("EBIDT growth 10Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(ebitdaAnnual, ctx, 10),
  ),
  R("EPS growth 3Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(epsAnnual, ctx, 3),
  ),
  R("EPS growth 5Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(epsAnnual, ctx, 5),
  ),
  R("EPS growth 7Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(epsAnnual, ctx, 7),
  ),
  R("EPS growth 10Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(epsAnnual, ctx, 10),
  ),
  R("Profit growth 7Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(incomeAnnual, ctx, 7),
  ),
  R("Profit growth 10Years", ["annual"], "historical", "percent", (ctx) =>
    annualGrowth(incomeAnnual, ctx, 10),
  ),
  R(
    "Change in promoter holding 3Years",
    ["annual"],
    "historical",
    "percent",
    unsupported,
  ),
  R("Average Earnings 5Year", ["annual"], "historical", "currency", (ctx) =>
    avgAnnual(incomeAnnual, ctx, 5),
  ),
  R("Average Earnings 10Year", ["annual"], "historical", "currency", (ctx) =>
    avgAnnual(incomeAnnual, ctx, 10),
  ),
  R("Average EBIT 5Year", ["annual"], "historical", "currency", (ctx) =>
    avgAnnual((c, i) => ebitOf(at(c.annualIncome, i)), ctx, 5),
  ),
  R("Average EBIT 10Year", ["annual"], "historical", "currency", (ctx) =>
    avgAnnual((c, i) => ebitOf(at(c.annualIncome, i)), ctx, 10),
  ),
];

const qBack = (
  ctx: QuickRatioContext,
  quartersBack: number,
  ...names: readonly string[]
): number | null => val(at(ctx.quarterlyIncome, quartersBack), ...names);

const QUARTER_RECENT: readonly RawDef[] = [
  R(
    "Operating profit latest quarter",
    ["quarter"],
    "recent",
    "currency",
    (ctx) => qBack(ctx, 0, ...OP_INC),
  ),
  R("Other income latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 0, ...OTHER_INC),
  ),
  R("EBIDT latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    ebitdaOf(at(ctx.quarterlyIncome, 0)),
  ),
  R("Depreciation latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 0, ...DEP),
  ),
  R("EBIT latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    ebitOf(at(ctx.quarterlyIncome, 0)),
  ),
  R("Interest latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 0, ...INTEREST),
  ),
  R(
    "Profit before tax latest quarter",
    ["quarter"],
    "recent",
    "currency",
    (ctx) => qBack(ctx, 0, ...EBT),
  ),
  R("Tax latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 0, ...TAX),
  ),
  R(
    "Extraordinary items latest quarter",
    ["quarter"],
    "recent",
    "currency",
    (ctx) => qBack(ctx, 0, ...EXTRA),
  ),
  R("Net Profit latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 0, ...NET),
  ),
  R("GPM latest quarter", ["quarter"], "recent", "percent", (ctx) => {
    const g = qBack(ctx, 0, ...GROSS);
    const r = qBack(ctx, 0, ...REV);
    return g !== null && r ? (g / r) * 100 : null;
  }),
  R("OPM latest quarter", ["quarter"], "recent", "percent", (ctx) => {
    const op = qBack(ctx, 0, ...OP_INC);
    const r = qBack(ctx, 0, ...REV);
    return op !== null && r ? (op / r) * 100 : null;
  }),
  R("NPM latest quarter", ["quarter"], "recent", "percent", (ctx) => {
    const n = qBack(ctx, 0, ...NET);
    const r = qBack(ctx, 0, ...REV);
    return n !== null && r ? (n / r) * 100 : null;
  }),
  R("Equity Capital latest quarter", ["quarter"], "recent", "currency", (ctx) =>
    val(at(ctx.quarterlyBalance, 0), ...COMMON_CAP),
  ),
  R("EPS latest quarter", ["quarter"], "recent", "currency", (ctx) => {
    const shares = sharesOf(ctx);
    const n = qBack(ctx, 0, ...NET);
    return shares !== null && n !== null ? n / shares : null;
  }),
  R(
    "Operating profit 2quarters back",
    ["quarter"],
    "recent",
    "currency",
    (ctx) => qBack(ctx, 2, ...OP_INC),
  ),
  R(
    "Operating profit 3quarters back",
    ["quarter"],
    "recent",
    "currency",
    (ctx) => qBack(ctx, 3, ...OP_INC),
  ),
  R("Sales 2quarters back", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 2, ...REV),
  ),
  R("Sales 3quarters back", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 3, ...REV),
  ),
  R("Net profit 2quarters back", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 2, ...NET),
  ),
  R("Net profit 3quarters back", ["quarter"], "recent", "currency", (ctx) =>
    qBack(ctx, 3, ...NET),
  ),
  R("Operating profit growth", ["quarter"], "recent", "percent", (ctx) =>
    growth(opTtm(ctx), ttm(ctx.quarterlyIncome.slice(4, 8), 4, ...OP_INC)),
  ),
  R(
    "Expected quarterly sales growth",
    ["quarter"],
    "recent",
    "percent",
    unsupported,
  ),
  R("Expected quarterly sales", ["quarter"], "recent", "currency", unsupported),
  R(
    "Expected quarterly operating profit",
    ["quarter"],
    "recent",
    "currency",
    unsupported,
  ),
  R(
    "Expected quarterly net profit",
    ["quarter"],
    "recent",
    "currency",
    unsupported,
  ),
  R("Expected quarterly EPS", ["quarter"], "recent", "currency", unsupported),
];

const QUARTER_PRECEDING: readonly RawDef[] = [
  R("Sales preceding quarter", ["quarter"], "preceding", "currency", (ctx) =>
    qBack(ctx, 1, ...REV),
  ),
  R(
    "Operating profit preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => qBack(ctx, 1, ...OP_INC),
  ),
  R(
    "Other income preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => qBack(ctx, 1, ...OTHER_INC),
  ),
  R("EBIDT preceding quarter", ["quarter"], "preceding", "currency", (ctx) =>
    ebitdaOf(at(ctx.quarterlyIncome, 1)),
  ),
  R(
    "Depreciation preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => qBack(ctx, 1, ...DEP),
  ),
  R("EBIT preceding quarter", ["quarter"], "preceding", "currency", (ctx) =>
    ebitOf(at(ctx.quarterlyIncome, 1)),
  ),
  R("Interest preceding quarter", ["quarter"], "preceding", "currency", (ctx) =>
    qBack(ctx, 1, ...INTEREST),
  ),
  R(
    "Profit before tax preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => qBack(ctx, 1, ...EBT),
  ),
  R("Tax preceding quarter", ["quarter"], "preceding", "currency", (ctx) =>
    qBack(ctx, 1, ...TAX),
  ),
  R(
    "Extraordinary items preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => qBack(ctx, 1, ...EXTRA),
  ),
  R(
    "Net Profit preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => qBack(ctx, 1, ...NET),
  ),
  R("OPM preceding quarter", ["quarter"], "preceding", "percent", (ctx) => {
    const op = qBack(ctx, 1, ...OP_INC);
    const r = qBack(ctx, 1, ...REV);
    return op !== null && r ? (op / r) * 100 : null;
  }),
  R("NPM preceding quarter", ["quarter"], "preceding", "percent", (ctx) => {
    const n = qBack(ctx, 1, ...NET);
    const r = qBack(ctx, 1, ...REV);
    return n !== null && r ? (n / r) * 100 : null;
  }),
  R(
    "Equity Capital preceding quarter",
    ["quarter"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.quarterlyBalance, 1), ...COMMON_CAP),
  ),
  R("EPS preceding quarter", ["quarter"], "preceding", "currency", (ctx) => {
    const shares = sharesOf(ctx);
    const n = qBack(ctx, 1, ...NET);
    return shares !== null && n !== null ? n / shares : null;
  }),
];

const QUARTER_HISTORICAL: readonly RawDef[] = [
  R(
    "Sales preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...REV),
  ),
  R(
    "Operating profit preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...OP_INC),
  ),
  R(
    "Other income preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...OTHER_INC),
  ),
  R(
    "EBIDT preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => ebitdaOf(at(ctx.quarterlyIncome, 4)),
  ),
  R(
    "Depreciation preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...DEP),
  ),
  R(
    "EBIT preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => ebitOf(at(ctx.quarterlyIncome, 4)),
  ),
  R(
    "Interest preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...INTEREST),
  ),
  R(
    "Profit before tax preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...EBT),
  ),
  R(
    "Tax preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...TAX),
  ),
  R(
    "Profit after tax preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...NET),
  ),
  R(
    "Extraordinary items preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...EXTRA),
  ),
  R(
    "Net Profit preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => qBack(ctx, 4, ...NET),
  ),
  R(
    "OPM preceding year quarter",
    ["quarter"],
    "historical",
    "percent",
    (ctx) => {
      const op = qBack(ctx, 4, ...OP_INC);
      const r = qBack(ctx, 4, ...REV);
      return op !== null && r ? (op / r) * 100 : null;
    },
  ),
  R(
    "NPM preceding year quarter",
    ["quarter"],
    "historical",
    "percent",
    (ctx) => {
      const n = qBack(ctx, 4, ...NET);
      const r = qBack(ctx, 4, ...REV);
      return n !== null && r ? (n / r) * 100 : null;
    },
  ),
  R(
    "Equity Capital preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => val(at(ctx.quarterlyBalance, 4), ...COMMON_CAP),
  ),
  R(
    "EPS preceding year quarter",
    ["quarter"],
    "historical",
    "currency",
    (ctx) => {
      const shares = sharesOf(ctx);
      const n = qBack(ctx, 4, ...NET);
      return shares !== null && n !== null ? n / shares : null;
    },
  ),
];

const BALANCE_RECENT: readonly RawDef[] = [
  R("Equity capital", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...COMMON_CAP),
  ),
  R("Preference capital", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), "preferredStock"),
  ),
  R("Reserves", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...RETAINED, "otherStockholderEquity"),
  ),
  R("Secured loan", ["balance"], "recent", "currency", unsupported),
  R("Unsecured loan", ["balance"], "recent", "currency", unsupported),
  R("Balance sheet total", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...TOTAL_A),
  ),
  R("Gross block", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...GROSS_BLOCK),
  ),
  R("Revaluation reserve", ["balance"], "recent", "currency", unsupported),
  R("Accumulated depreciation", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...ACCUM_DEP),
  ),
  R("Net block", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...NET_BLOCK),
  ),
  R("Capital work in progress", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...CWIP),
  ),
  R("Investments", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...INVEST),
  ),
  R("Current assets", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...CURR_A),
  ),
  R("Current liabilities", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...CURR_L),
  ),
  R(
    "Book value of unquoted investments",
    ["balance"],
    "recent",
    "currency",
    unsupported,
  ),
  R(
    "Market value of quoted investments",
    ["balance"],
    "recent",
    "currency",
    unsupported,
  ),
  R("Contingent liabilities", ["balance"], "recent", "currency", unsupported),
  R("Total Assets", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...TOTAL_A),
  ),
  R("Working capital", ["balance"], "recent", "currency", (ctx) =>
    wcOf(at(ctx.annualBalance, 0)),
  ),
  R("Lease liabilities", ["balance"], "recent", "currency", (ctx) =>
    val(
      at(ctx.annualBalance, 0),
      "capitalLeaseObligations",
      "leaseLiabilities",
    ),
  ),
  R("Inventory", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...INV),
  ),
  R("Trade receivables", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...REC),
  ),
  R("Face value", ["balance"], "recent", "currency", (ctx) => ctx.faceValue),
  R("Cash Equivalents", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...CASH),
  ),
  R("Advance from Customers", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...ADV_CUST),
  ),
  R("Trade Payables", ["balance"], "recent", "currency", (ctx) =>
    val(at(ctx.annualBalance, 0), ...PAYABLES),
  ),
];

const BALANCE_PRECEDING: readonly RawDef[] = [
  R(
    "Number of equity shares preceding year",
    ["balance"],
    "preceding",
    "number",
    unsupported,
  ),
  R("Debt preceding year", ["balance"], "preceding", "currency", (ctx) =>
    debtOf(at(ctx.annualBalance, 1)),
  ),
  R(
    "Working capital preceding year",
    ["balance"],
    "preceding",
    "currency",
    (ctx) => wcOf(at(ctx.annualBalance, 1)),
  ),
  R("Net block preceding year", ["balance"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualBalance, 1), ...NET_BLOCK),
  ),
  R("Gross block preceding year", ["balance"], "preceding", "currency", (ctx) =>
    val(at(ctx.annualBalance, 1), ...GROSS_BLOCK),
  ),
  R(
    "Capital work in progress preceding year",
    ["balance"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualBalance, 1), ...CWIP),
  ),
];

const backYears = (
  ctx: QuickRatioContext,
  yearsBack: number,
  ...names: readonly string[]
): number | null => val(at(ctx.annualBalance, yearsBack), ...names);

const BALANCE_HISTORICAL: readonly RawDef[] = [
  R(
    "Working capital 3Years back",
    ["balance"],
    "historical",
    "currency",
    (ctx) => wcOf(at(ctx.annualBalance, 3)),
  ),
  R(
    "Working capital 5Years back",
    ["balance"],
    "historical",
    "currency",
    (ctx) => wcOf(at(ctx.annualBalance, 5)),
  ),
  R(
    "Working capital 7Years back",
    ["balance"],
    "historical",
    "currency",
    (ctx) => wcOf(at(ctx.annualBalance, 7)),
  ),
  R(
    "Working capital 10Years back",
    ["balance"],
    "historical",
    "currency",
    (ctx) => wcOf(at(ctx.annualBalance, 10)),
  ),
  R("Debt 3Years back", ["balance"], "historical", "currency", (ctx) =>
    debtOf(at(ctx.annualBalance, 3)),
  ),
  R("Debt 5Years back", ["balance"], "historical", "currency", (ctx) =>
    debtOf(at(ctx.annualBalance, 5)),
  ),
  R("Debt 7Years back", ["balance"], "historical", "currency", (ctx) =>
    debtOf(at(ctx.annualBalance, 7)),
  ),
  R("Debt 10Years back", ["balance"], "historical", "currency", (ctx) =>
    debtOf(at(ctx.annualBalance, 10)),
  ),
  R("Net block 3Years back", ["balance"], "historical", "currency", (ctx) =>
    backYears(ctx, 3, ...NET_BLOCK),
  ),
  R("Net block 5Years back", ["balance"], "historical", "currency", (ctx) =>
    backYears(ctx, 5, ...NET_BLOCK),
  ),
  R("Net block 7Years back", ["balance"], "historical", "currency", (ctx) =>
    backYears(ctx, 7, ...NET_BLOCK),
  ),
  R("Net block 10Years back", ["balance"], "historical", "currency", (ctx) =>
    backYears(ctx, 10, ...NET_BLOCK),
  ),
];

const CASHFLOW_RECENT: readonly RawDef[] = [
  R(
    "Cash from operations last year",
    ["cashflow"],
    "recent",
    "currency",
    (ctx) => val(at(ctx.annualCash, 0), ...OCF),
  ),
  R("Free cash flow last year", ["cashflow"], "recent", "currency", (ctx) =>
    fcfOf(at(ctx.annualCash, 0)),
  ),
  R(
    "Cash from investing last year",
    ["cashflow"],
    "recent",
    "currency",
    (ctx) => val(at(ctx.annualCash, 0), ...ICF),
  ),
  R(
    "Cash from financing last year",
    ["cashflow"],
    "recent",
    "currency",
    (ctx) => val(at(ctx.annualCash, 0), ...FCF_FIN),
  ),
  R("Net cash flow last year", ["cashflow"], "recent", "currency", (ctx) =>
    val(at(ctx.annualCash, 0), ...NET_CHG),
  ),
  R("Cash beginning of last year", ["cashflow"], "recent", "currency", (ctx) =>
    val(at(ctx.annualCash, 0), ...CASH_BEG),
  ),
  R("Cash end of last year", ["cashflow"], "recent", "currency", (ctx) =>
    val(at(ctx.annualCash, 0), ...CASH_END),
  ),
];

const CASHFLOW_PRECEDING: readonly RawDef[] = [
  R(
    "Free cash flow preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => fcfOf(at(ctx.annualCash, 1)),
  ),
  R(
    "Cash from operations preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualCash, 1), ...OCF),
  ),
  R(
    "Cash from investing preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualCash, 1), ...ICF),
  ),
  R(
    "Cash from financing preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualCash, 1), ...FCF_FIN),
  ),
  R(
    "Net cash flow preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualCash, 1), ...NET_CHG),
  ),
  R(
    "Cash beginning of preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualCash, 1), ...CASH_BEG),
  ),
  R(
    "Cash end of preceding year",
    ["cashflow"],
    "preceding",
    "currency",
    (ctx) => val(at(ctx.annualCash, 1), ...CASH_END),
  ),
];

const fcfBack = (ctx: QuickRatioContext, yearsBack: number): number | null =>
  fcfOf(at(ctx.annualCash, yearsBack));

const ocfBack = (ctx: QuickRatioContext, yearsBack: number): number | null =>
  val(at(ctx.annualCash, yearsBack), ...OCF);

const CASHFLOW_HISTORICAL: readonly RawDef[] = [
  R("Free cash flow 3years", ["cashflow"], "historical", "currency", (ctx) =>
    fcfBack(ctx, 3),
  ),
  R("Free cash flow 5years", ["cashflow"], "historical", "currency", (ctx) =>
    fcfBack(ctx, 5),
  ),
  R("Free cash flow 7years", ["cashflow"], "historical", "currency", (ctx) =>
    fcfBack(ctx, 7),
  ),
  R("Free cash flow 10years", ["cashflow"], "historical", "currency", (ctx) =>
    fcfBack(ctx, 10),
  ),
  R(
    "Operating cash flow 3years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => ocfBack(ctx, 3),
  ),
  R(
    "Operating cash flow 5years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => ocfBack(ctx, 5),
  ),
  R(
    "Operating cash flow 7years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => ocfBack(ctx, 7),
  ),
  R(
    "Operating cash flow 10years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => ocfBack(ctx, 10),
  ),
  R(
    "Investing cash flow 10years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => val(at(ctx.annualCash, 10), ...ICF),
  ),
  R(
    "Investing cash flow 7years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => val(at(ctx.annualCash, 7), ...ICF),
  ),
  R(
    "Investing cash flow 5years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => val(at(ctx.annualCash, 5), ...ICF),
  ),
  R(
    "Investing cash flow 3years",
    ["cashflow"],
    "historical",
    "currency",
    (ctx) => val(at(ctx.annualCash, 3), ...ICF),
  ),
  R("Cash 3Years back", ["cashflow"], "historical", "currency", (ctx) =>
    val(at(ctx.annualBalance, 3), ...CASH),
  ),
  R("Cash 5Years back", ["cashflow"], "historical", "currency", (ctx) =>
    val(at(ctx.annualBalance, 5), ...CASH),
  ),
  R("Cash 7Years back", ["cashflow"], "historical", "currency", (ctx) =>
    val(at(ctx.annualBalance, 7), ...CASH),
  ),
];

const investedCapital = (
  ctx: QuickRatioContext,
  index: number,
): number | null => {
  const equity = val(at(ctx.annualBalance, index), ...EQUITY);
  const debt = debtOf(at(ctx.annualBalance, index));
  return equity !== null && debt !== null ? equity + debt : null;
};

const roicAnnual = (ctx: QuickRatioContext, index: number): number | null => {
  const ebit = ebitOf(at(ctx.annualIncome, index));
  const ebt = val(at(ctx.annualIncome, index), ...EBT);
  const tax = val(at(ctx.annualIncome, index), ...TAX);
  const invested = investedCapital(ctx, index);
  const rate = ebit !== null && ebt ? (tax ?? 0) / ebt : null;
  return ebit !== null && invested
    ? ((ebit * (1 - (rate ?? 0))) / invested) * 100
    : null;
};

const debtorDaysAnnual = (
  ctx: QuickRatioContext,
  index: number,
): number | null => {
  const rec = val(at(ctx.annualBalance, index), ...REC);
  const rev = val(at(ctx.annualIncome, index), ...REV);
  return rec !== null && rev ? (rec / rev) * 365 : null;
};

const piotroski = (ctx: QuickRatioContext): number | null => {
  const c0 = at(ctx.annualIncome, 0);
  const c1 = at(ctx.annualIncome, 1);
  const b0 = at(ctx.annualBalance, 0);
  const b1 = at(ctx.annualBalance, 1);
  const f0 = at(ctx.annualCash, 0);
  if (!c0 || !c1 || !b0 || !b1 || !f0) return null;
  let score = 0;
  const roa0 = roaAnnual(ctx, 0);
  const roa1 = roaAnnual(ctx, 1);
  if (roa0 !== null && roa0 > 0) score += 1;
  if (roa0 !== null && roa1 !== null && roa0 > roa1) score += 1;
  const ocf = val(f0, ...OCF);
  const ni = val(c0, ...NET);
  if (ocf !== null && ocf > 0) score += 1;
  if (ocf !== null && ni !== null && ocf > ni) score += 1;
  const d0 = debtOf(b0);
  const d1 = debtOf(b1);
  const a0 = val(b0, ...TOTAL_A);
  const a1 = val(b1, ...TOTAL_A);
  if (d0 !== null && d1 !== null && a0 && a1 && d0 / a0 < d1 / a1) score += 1;
  const ca0 = val(b0, ...CURR_A);
  const cl0 = val(b0, ...CURR_L);
  const ca1 = val(b1, ...CURR_A);
  const cl1 = val(b1, ...CURR_L);
  if (ca0 !== null && cl0 && ca1 !== null && cl1 && ca0 / cl0 > ca1 / cl1)
    score += 1;
  if (val(b0, ...COMMON_CAP) === val(b1, ...COMMON_CAP)) score += 1;
  const gm0 =
    val(c0, ...GROSS) !== null && val(c0, ...REV)
      ? (val(c0, ...GROSS) as number) / (val(c0, ...REV) as number)
      : null;
  const gm1 =
    val(c1, ...GROSS) !== null && val(c1, ...REV)
      ? (val(c1, ...GROSS) as number) / (val(c1, ...REV) as number)
      : null;
  if (gm0 !== null && gm1 !== null && gm0 > gm1) score += 1;
  const t0 =
    val(c0, ...REV) !== null && a0
      ? (val(c0, ...REV) as number) / (a0 as number)
      : null;
  const t1 =
    val(c1, ...REV) !== null && a1
      ? (val(c1, ...REV) as number) / (a1 as number)
      : null;
  if (t0 !== null && t1 !== null && t0 > t1) score += 1;
  return score;
};

const altmanZ = (ctx: QuickRatioContext): number | null => {
  const b = at(ctx.annualBalance, 0);
  const i = at(ctx.annualIncome, 0);
  if (!b || !i) return null;
  const ta = val(b, ...TOTAL_A);
  const wc = wcOf(b);
  const re = val(b, ...RETAINED);
  const ebit = ebitOf(i);
  const rev = val(i, ...REV);
  const tl = val(b, "totalLiab", "totalLiabilities");
  const mcap = ctx.metrics.marketCapitalization ?? ctx.quote.marketCap;
  if (
    !ta ||
    wc === null ||
    re === null ||
    ebit === null ||
    rev === null ||
    !tl ||
    !mcap
  )
    return null;
  return (
    (1.2 * wc) / ta +
    (1.4 * re) / ta +
    (3.3 * ebit) / ta +
    (0.6 * mcap) / tl +
    rev / ta
  );
};

const grahamNumber = (ctx: QuickRatioContext): number | null => {
  const eps =
    ctx.metrics.dilutedEpsTtm ??
    ctx.metrics.earningsPerShare ??
    epsAnnual(ctx, 0);
  const bv = ctx.metrics.bookValue;
  return eps !== undefined && eps !== null && eps > 0 && bv != null && bv > 0
    ? Math.sqrt(22.5 * eps * bv)
    : null;
};

const RATIOS_RECENT: readonly RawDef[] = [
  R("Price to Quarterly Earning", ["ratios"], "recent", "multiple", (ctx) => {
    const q = qBack(ctx, 0, ...NET);
    const shares = sharesOf(ctx);
    const qeps = q !== null && shares !== null ? q / shares : null;
    return qeps && ctx.quote.price ? ctx.quote.price / qeps : null;
  }),
  R(
    "Book value",
    ["ratios"],
    "recent",
    "currency",
    (ctx) => ctx.metrics.bookValue ?? null,
  ),
  R("Inventory turnover ratio", ["ratios"], "recent", "multiple", (ctx) => {
    const cogs = val(at(ctx.annualIncome, 0), ...MAT_COST);
    const inv = val(at(ctx.annualBalance, 0), ...INV);
    const rev = val(at(ctx.annualIncome, 0), ...REV);
    const base = cogs ?? rev;
    return base !== null && inv ? base / inv : null;
  }),
  R("Quick ratio", ["ratios"], "recent", "multiple", (ctx) => {
    const a = val(at(ctx.annualBalance, 0), ...CURR_A);
    const inv = val(at(ctx.annualBalance, 0), ...INV);
    const l = val(at(ctx.annualBalance, 0), ...CURR_L);
    return a !== null && inv !== null && l ? (a - inv) / l : null;
  }),
  R("Exports percentage", ["ratios"], "recent", "percent", unsupported),
  R("Piotroski score", ["ratios"], "recent", "number", (ctx) => piotroski(ctx)),
  R("G Factor", ["ratios"], "recent", "number", unsupported),
  R("Asset Turnover Ratio", ["ratios"], "recent", "multiple", (ctx) => {
    const rev = val(at(ctx.annualIncome, 0), ...REV);
    const assets = val(at(ctx.annualBalance, 0), ...TOTAL_A);
    return rev !== null && assets ? rev / assets : null;
  }),
  R("Financial leverage", ["ratios"], "recent", "multiple", (ctx) => {
    const assets = val(at(ctx.annualBalance, 0), ...TOTAL_A);
    const equity = val(at(ctx.annualBalance, 0), ...EQUITY);
    return assets !== null && equity ? assets / equity : null;
  }),
  R("Number of Shareholders", ["ratios"], "recent", "number", unsupported),
  R("Unpledged promoter holding", ["ratios"], "recent", "percent", unsupported),
  R("Return on invested capital", ["ratios"], "recent", "percent", (ctx) =>
    roicAnnual(ctx, 0),
  ),
  R("Debtor days", ["ratios"], "recent", "number", (ctx) =>
    debtorDaysAnnual(ctx, 0),
  ),
  R("Industry PBV", ["ratios"], "recent", "multiple", unsupported),
  R("Working Capital Days", ["ratios"], "recent", "number", (ctx) => {
    const wc = wcOf(at(ctx.annualBalance, 0));
    const rev = val(at(ctx.annualIncome, 0), ...REV);
    return wc !== null && rev ? (wc / rev) * 365 : null;
  }),
  R("Earning Power", ["ratios"], "recent", "multiple", unsupported),
  R("Graham Number", ["ratios"], "recent", "currency", (ctx) =>
    grahamNumber(ctx),
  ),
  R("Cash Conversion Cycle", ["ratios"], "recent", "number", (ctx) => {
    const rec = val(at(ctx.annualBalance, 0), ...REC);
    const inv = val(at(ctx.annualBalance, 0), ...INV);
    const pay = val(at(ctx.annualBalance, 0), ...PAYABLES);
    const rev = val(at(ctx.annualIncome, 0), ...REV);
    const cogs = val(at(ctx.annualIncome, 0), ...MAT_COST) ?? rev;
    if (
      rec === null ||
      inv === null ||
      pay === null ||
      rev == null ||
      !rev ||
      cogs == null ||
      !cogs
    )
      return null;
    return (rec / rev) * 365 + (inv / cogs) * 365 - (pay / cogs) * 365;
  }),
  R("Days Payable Outstanding", ["ratios"], "recent", "number", (ctx) => {
    const pay = val(at(ctx.annualBalance, 0), ...PAYABLES);
    const cogs =
      val(at(ctx.annualIncome, 0), ...MAT_COST) ??
      val(at(ctx.annualIncome, 0), ...REV);
    return pay !== null && cogs ? (pay / cogs) * 365 : null;
  }),
  R("Days Receivable Outstanding", ["ratios"], "recent", "number", (ctx) =>
    debtorDaysAnnual(ctx, 0),
  ),
  R("Days Inventory Outstanding", ["ratios"], "recent", "number", (ctx) => {
    const inv = val(at(ctx.annualBalance, 0), ...INV);
    const cogs =
      val(at(ctx.annualIncome, 0), ...MAT_COST) ??
      val(at(ctx.annualIncome, 0), ...REV);
    return inv !== null && cogs ? (inv / cogs) * 365 : null;
  }),
  R("Public holding", ["ratios"], "recent", "percent", unsupported),
  R("FII holding", ["ratios"], "recent", "percent", unsupported),
  R("Change in FII holding", ["ratios"], "recent", "percent", unsupported),
  R("DII holding", ["ratios"], "recent", "percent", unsupported),
  R("Change in DII holding", ["ratios"], "recent", "percent", unsupported),
  R("Number of equity shares", ["ratios"], "recent", "number", (ctx) =>
    sharesOf(ctx),
  ),
];

const RATIOS_PRECEDING: readonly RawDef[] = [
  R("Book value preceding year", ["ratios"], "preceding", "currency", (ctx) => {
    const equity = val(at(ctx.annualBalance, 1), ...EQUITY);
    const shares = sharesOf(ctx);
    return equity !== null && shares !== null ? equity / shares : null;
  }),
  R(
    "Return on capital employed preceding year",
    ["ratios"],
    "preceding",
    "percent",
    (ctx) => roceAnnual(ctx, 1),
  ),
  R(
    "Return on assets preceding year",
    ["ratios"],
    "preceding",
    "percent",
    (ctx) => roaAnnual(ctx, 1),
  ),
  R(
    "Return on equity preceding year",
    ["ratios"],
    "preceding",
    "percent",
    (ctx) => roeAnnual(ctx, 1),
  ),
  R(
    "Number of Shareholders preceding quarter",
    ["ratios"],
    "preceding",
    "number",
    unsupported,
  ),
];

const histPe = (ctx: QuickRatioContext, yearsBack: number): number | null => {
  const anchor = priceAgo(ctx.history, yearsBack * 365);
  const eps = epsAnnual(ctx, yearsBack);
  return anchor !== null && eps ? anchor / eps : null;
};

const histPbv = (ctx: QuickRatioContext, yearsBack: number): number | null => {
  const anchor = priceAgo(ctx.history, yearsBack * 365);
  const equity = val(at(ctx.annualBalance, yearsBack), ...EQUITY);
  const shares = sharesOf(ctx);
  const bv = equity !== null && shares !== null ? equity / shares : null;
  return anchor !== null && bv ? anchor / bv : null;
};

const RATIOS_HISTORICAL: readonly RawDef[] = [
  R(
    "Average return on equity 10Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roeAnnual, ctx, 10),
  ),
  R(
    "Average return on equity 7Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roeAnnual, ctx, 7),
  ),
  R(
    "Return on equity 5years growth",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => growth(roeAnnual(ctx, 0), roeAnnual(ctx, 5)),
  ),
  R("OPM 5Year", ["ratios"], "historical", "percent", (ctx) =>
    avgAnnual(opmAnnual, ctx, 5),
  ),
  R("OPM 10Year", ["ratios"], "historical", "percent", (ctx) =>
    avgAnnual(opmAnnual, ctx, 10),
  ),
  R(
    "Number of equity shares 10years back",
    ["ratios"],
    "historical",
    "number",
    unsupported,
  ),
  R("Book value 3years back", ["ratios"], "historical", "currency", (ctx) => {
    const equity = val(at(ctx.annualBalance, 3), ...EQUITY);
    const shares = sharesOf(ctx);
    return equity !== null && shares !== null ? equity / shares : null;
  }),
  R("Book value 5years back", ["ratios"], "historical", "currency", (ctx) => {
    const equity = val(at(ctx.annualBalance, 5), ...EQUITY);
    const shares = sharesOf(ctx);
    return equity !== null && shares !== null ? equity / shares : null;
  }),
  R("Book value 10years back", ["ratios"], "historical", "currency", (ctx) => {
    const equity = val(at(ctx.annualBalance, 10), ...EQUITY);
    const shares = sharesOf(ctx);
    return equity !== null && shares !== null ? equity / shares : null;
  }),
  R(
    "Inventory turnover ratio 3Years back",
    ["ratios"],
    "historical",
    "multiple",
    (ctx) => {
      const cogs =
        val(at(ctx.annualIncome, 3), ...MAT_COST) ??
        val(at(ctx.annualIncome, 3), ...REV);
      const inv = val(at(ctx.annualBalance, 3), ...INV);
      return cogs !== null && inv ? cogs / inv : null;
    },
  ),
  R(
    "Inventory turnover ratio 5Years back",
    ["ratios"],
    "historical",
    "multiple",
    (ctx) => {
      const cogs =
        val(at(ctx.annualIncome, 5), ...MAT_COST) ??
        val(at(ctx.annualIncome, 5), ...REV);
      const inv = val(at(ctx.annualBalance, 5), ...INV);
      return cogs !== null && inv ? cogs / inv : null;
    },
  ),
  R(
    "Inventory turnover ratio 7Years back",
    ["ratios"],
    "historical",
    "multiple",
    (ctx) => {
      const cogs =
        val(at(ctx.annualIncome, 7), ...MAT_COST) ??
        val(at(ctx.annualIncome, 7), ...REV);
      const inv = val(at(ctx.annualBalance, 7), ...INV);
      return cogs !== null && inv ? cogs / inv : null;
    },
  ),
  R(
    "Inventory turnover ratio 10Years back",
    ["ratios"],
    "historical",
    "multiple",
    (ctx) => {
      const cogs =
        val(at(ctx.annualIncome, 10), ...MAT_COST) ??
        val(at(ctx.annualIncome, 10), ...REV);
      const inv = val(at(ctx.annualBalance, 10), ...INV);
      return cogs !== null && inv ? cogs / inv : null;
    },
  ),
  R(
    "Exports percentage 3Years back",
    ["ratios"],
    "historical",
    "percent",
    unsupported,
  ),
  R(
    "Exports percentage 5Years back",
    ["ratios"],
    "historical",
    "percent",
    unsupported,
  ),
  R("Average 5years dividend", ["ratios"], "historical", "currency", (ctx) =>
    avgAnnual((c, i) => val(at(c.annualCash, i), ...DIV_PAID), ctx, 5),
  ),
  R(
    "Average return on capital employed 3Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roceAnnual, ctx, 3),
  ),
  R(
    "Average return on capital employed 5Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roceAnnual, ctx, 5),
  ),
  R(
    "Average return on capital employed 7Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roceAnnual, ctx, 7),
  ),
  R(
    "Average return on capital employed 10Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roceAnnual, ctx, 10),
  ),
  R(
    "Median return on capital employed 5Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => median([0, 1, 2, 3, 4].map((i) => roceAnnual(ctx, i))),
  ),
  R(
    "Median return on capital employed 10Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) =>
      median([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => roceAnnual(ctx, i))),
  ),
  R(
    "Average return on equity 10Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roeAnnual, ctx, 10),
  ),
  R(
    "Average return on equity 7Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roeAnnual, ctx, 7),
  ),
  R(
    "Average dividend payout 3years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) =>
      avgAnnual(
        (c, i) => {
          const div = val(at(c.annualCash, i), ...DIV_PAID);
          const ni = val(at(c.annualIncome, i), ...NET);
          return div !== null && ni ? (div / ni) * 100 : null;
        },
        ctx,
        3,
      ),
  ),
  R(
    "Average return on invested capital 3Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roicAnnual, ctx, 3),
  ),
  R(
    "Average return on invested capital 5Years",
    ["ratios"],
    "historical",
    "percent",
    (ctx) => avgAnnual(roicAnnual, ctx, 5),
  ),
  R("Average debtor days 3years", ["ratios"], "historical", "number", (ctx) =>
    avgAnnual(debtorDaysAnnual, ctx, 3),
  ),
  R("Debtor days 3years back", ["ratios"], "historical", "number", (ctx) =>
    debtorDaysAnnual(ctx, 3),
  ),
  R("Debtor days 5years back", ["ratios"], "historical", "number", (ctx) =>
    debtorDaysAnnual(ctx, 5),
  ),
  R("Return on assets 5years", ["ratios"], "historical", "percent", (ctx) =>
    avgAnnual(roaAnnual, ctx, 5),
  ),
  R("Return on assets 3years", ["ratios"], "historical", "percent", (ctx) =>
    avgAnnual(roaAnnual, ctx, 3),
  ),
  R("Historical PE 3Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPe(ctx, 3),
  ),
  R("Historical PE 10Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPe(ctx, 10),
  ),
  R("Historical PE 7Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPe(ctx, 7),
  ),
  R("Historical PE 5Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPe(ctx, 5),
  ),
  R("Historical PBV 3Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPbv(ctx, 3),
  ),
  R("Historical PBV 5Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPbv(ctx, 5),
  ),
  R("Historical PBV 7Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPbv(ctx, 7),
  ),
  R("Historical PBV 10Years", ["ratios"], "historical", "multiple", (ctx) =>
    histPbv(ctx, 10),
  ),
  R(
    "Market Capitalization 3years back",
    ["ratios"],
    "historical",
    "currency",
    (ctx) => {
      const anchor = priceAgo(ctx.history, 3 * 365);
      const shares = sharesOf(ctx);
      return anchor !== null && shares !== null ? anchor * shares : null;
    },
  ),
  R(
    "Market Capitalization 5years back",
    ["ratios"],
    "historical",
    "currency",
    (ctx) => {
      const anchor = priceAgo(ctx.history, 5 * 365);
      const shares = sharesOf(ctx);
      return anchor !== null && shares !== null ? anchor * shares : null;
    },
  ),
  R(
    "Market Capitalization 7years back",
    ["ratios"],
    "historical",
    "currency",
    (ctx) => {
      const anchor = priceAgo(ctx.history, 7 * 365);
      const shares = sharesOf(ctx);
      return anchor !== null && shares !== null ? anchor * shares : null;
    },
  ),
  R(
    "Market Capitalization 10years back",
    ["ratios"],
    "historical",
    "currency",
    (ctx) => {
      const anchor = priceAgo(ctx.history, 10 * 365);
      const shares = sharesOf(ctx);
      return anchor !== null && shares !== null ? anchor * shares : null;
    },
  ),
  R(
    "Average Working Capital Days 3years",
    ["ratios"],
    "historical",
    "number",
    (ctx) =>
      avgAnnual(
        (c, i) => {
          const wc = wcOf(at(c.annualBalance, i));
          const rev = val(at(c.annualIncome, i), ...REV);
          return wc !== null && rev ? (wc / rev) * 365 : null;
        },
        ctx,
        3,
      ),
  ),
  R(
    "Change in FII holding 3Years",
    ["ratios"],
    "historical",
    "percent",
    unsupported,
  ),
  R(
    "Change in DII holding 3Years",
    ["ratios"],
    "historical",
    "percent",
    unsupported,
  ),
];

const PRICE_RECENT: readonly RawDef[] = [
  R("Return over 1day", ["price"], "recent", "percent", (ctx) => {
    const closes = closesOf(ctx);
    if (closes.length < 2 || ctx.quote.price === null) return null;
    return growth(ctx.quote.price, closes[closes.length - 2]);
  }),
  R("Return over 1week", ["price"], "recent", "percent", (ctx) =>
    returnOverSessions(ctx, 5),
  ),
  R("Return over 1month", ["price"], "recent", "percent", (ctx) =>
    returnOverDays(ctx, 30),
  ),
  R("Is SME", ["price"], "recent", "number", unsupported),
  R("Is not SME", ["price"], "recent", "number", unsupported),
  R("Volume 1month average", ["price"], "recent", "number", unsupported),
  R("Volume 1week average", ["price"], "recent", "number", unsupported),
  R("Volume", ["price"], "recent", "number", (ctx) => ctx.quote.volume),
  R("High price", ["price"], "recent", "currency", (ctx) => ctx.quote.dayHigh),
  R("Low price", ["price"], "recent", "currency", (ctx) => ctx.quote.dayLow),
  R("High price all time", ["price"], "recent", "currency", (ctx) => {
    const closes = closesOf(ctx);
    const stored = closes.length ? Math.max(...closes) : null;
    const candidates = [stored, ctx.quote.week52High, ctx.quote.dayHigh].filter(
      (v): v is number => v !== null,
    );
    return candidates.length ? Math.max(...candidates) : null;
  }),
  R("Low price all time", ["price"], "recent", "currency", (ctx) => {
    const closes = closesOf(ctx);
    const stored = closes.length ? Math.min(...closes) : null;
    const candidates = [stored, ctx.quote.week52Low, ctx.quote.dayLow].filter(
      (v): v is number => v !== null,
    );
    return candidates.length ? Math.min(...candidates) : null;
  }),
  R(
    "DMA 50",
    ["price"],
    "recent",
    "currency",
    (ctx) => ctx.metrics.fiftyDayMovingAverage ?? sma(closesOf(ctx), 50),
  ),
  R(
    "DMA 200",
    ["price"],
    "recent",
    "currency",
    (ctx) => ctx.metrics.twoHundredDayMovingAverage ?? sma(closesOf(ctx), 200),
  ),
  R("DMA 50 previous day", ["price"], "recent", "currency", (ctx) =>
    sma(closesOf(ctx), 50, 1),
  ),
  R("DMA 200 previous day", ["price"], "recent", "currency", (ctx) =>
    sma(closesOf(ctx), 200, 1),
  ),
  R("RSI", ["price"], "recent", "number", (ctx) => rsi(closesOf(ctx))),
  R(
    "MACD",
    ["price"],
    "recent",
    "number",
    (ctx) => macdTriple(closesOf(ctx))?.macd ?? null,
  ),
  R("MACD Previous Day", ["price"], "recent", "number", (ctx) => {
    const closes = closesOf(ctx);
    if (closes.length < 36) return null;
    return macdTriple(closes.slice(0, -1))?.macd ?? null;
  }),
  R(
    "MACD Signal",
    ["price"],
    "recent",
    "number",
    (ctx) => macdTriple(closesOf(ctx))?.signal ?? null,
  ),
  R("MACD Signal Previous Day", ["price"], "recent", "number", (ctx) => {
    const closes = closesOf(ctx);
    if (closes.length < 36) return null;
    return macdTriple(closes.slice(0, -1))?.signal ?? null;
  }),
];

const PRICE_HISTORICAL: readonly RawDef[] = [
  R("Volume 1year average", ["price"], "historical", "number", unsupported),
  R("Return over 7years", ["price"], "historical", "percent", (ctx) =>
    returnOverDays(ctx, 7 * 365),
  ),
  R("Return over 10years", ["price"], "historical", "percent", (ctx) =>
    returnOverDays(ctx, 10 * 365),
  ),
];

const netWorthOf = (ctx: QuickRatioContext): number | null =>
  val(at(ctx.annualBalance, 0), ...EQUITY);

const USER_RECENT: readonly RawDef[] = [
  R("Working Capital to Sales ratio", ["user"], "recent", "multiple", (ctx) => {
    const wc = wcOf(at(ctx.annualBalance, 0));
    const rev = val(at(ctx.annualIncome, 0), ...REV);
    return wc !== null && rev ? wc / rev : null;
  }),
  R("QoQ Profits", ["user"], "recent", "percent", (ctx) =>
    growth(qBack(ctx, 0, ...NET), qBack(ctx, 1, ...NET)),
  ),
  R("QoQ Sales", ["user"], "recent", "percent", (ctx) =>
    growth(qBack(ctx, 0, ...REV), qBack(ctx, 1, ...REV)),
  ),
  R("Net worth", ["user"], "recent", "currency", (ctx) => netWorthOf(ctx)),
  R("Market Cap to Sales", ["user"], "recent", "multiple", (ctx) => {
    const mcap = ctx.metrics.marketCapitalization ?? ctx.quote.marketCap;
    const rev = salesTtm(ctx);
    return mcap != null && rev ? mcap / rev : null;
  }),
  R("Interest Coverage", ["user"], "recent", "multiple", (ctx) => {
    const ebit = ebitOf(at(ctx.annualIncome, 0));
    const interest = val(at(ctx.annualIncome, 0), ...INTEREST);
    return ebit !== null && interest ? ebit / interest : null;
  }),
  R("Enterprise Value to EBIT", ["user"], "recent", "multiple", (ctx) => {
    const ev = ctx.metrics.enterpriseValue;
    const ebit = ebitOf(at(ctx.annualIncome, 0));
    return ev != null && ebit ? ev / ebit : null;
  }),
  R("Debt Capacity", ["user"], "recent", "multiple", unsupported),
  R("Debt To Profit", ["user"], "recent", "multiple", (ctx) => {
    const debt = debtOf(at(ctx.annualBalance, 0));
    const ni = val(at(ctx.annualIncome, 0), ...NET);
    return debt !== null && ni ? debt / ni : null;
  }),
  R("Total Capital Employed", ["user"], "recent", "currency", (ctx) =>
    investedCapital(ctx, 0),
  ),
  R("CROIC", ["user"], "recent", "percent", (ctx) => {
    const fcf = fcfOf(at(ctx.annualCash, 0));
    const invested = investedCapital(ctx, 0);
    return fcf !== null && invested ? (fcf / invested) * 100 : null;
  }),
  R("debtplus", ["user"], "recent", "currency", unsupported),
  R("Leverage", ["user"], "recent", "multiple", (ctx) => {
    const assets = val(at(ctx.annualBalance, 0), ...TOTAL_A);
    const equity = val(at(ctx.annualBalance, 0), ...EQUITY);
    return assets !== null && equity ? assets / equity : null;
  }),
  R("Dividend Payout", ["user"], "recent", "percent", (ctx) => {
    const div = val(at(ctx.annualCash, 0), ...DIV_PAID);
    const ni = val(at(ctx.annualIncome, 0), ...NET);
    if (div !== null && ni) return (div / ni) * 100;
    return ctx.metrics.payoutRatio ?? null;
  }),
  R("Intrinsic Value", ["user"], "recent", "currency", unsupported),
  R(
    "cash debt contingent liabilities by mcap",
    ["user"],
    "recent",
    "multiple",
    unsupported,
  ),
  R("Cash by market cap", ["user"], "recent", "percent", (ctx) => {
    const cash = val(at(ctx.annualBalance, 0), ...CASH);
    const mcap = ctx.metrics.marketCapitalization ?? ctx.quote.marketCap;
    return cash !== null && mcap ? (cash / mcap) * 100 : null;
  }),
  R("52w Index", ["user"], "recent", "number", unsupported),
  R("Down from 52w high", ["user"], "recent", "percent", (ctx) => {
    const high = ctx.quote.week52High;
    return high && ctx.quote.price !== null
      ? ((high - ctx.quote.price) / high) * 100
      : null;
  }),
  R("Up from 52w low", ["user"], "recent", "percent", (ctx) => {
    const low = ctx.quote.week52Low;
    return low && ctx.quote.price !== null
      ? ((ctx.quote.price - low) / low) * 100
      : null;
  }),
  R("From 52w high", ["user"], "recent", "percent", (ctx) => {
    const high = ctx.quote.week52High;
    return high && ctx.quote.price !== null
      ? ((high - ctx.quote.price) / high) * 100
      : null;
  }),
  R("Mkt Cap To Debt Cap", ["user"], "recent", "multiple", (ctx) => {
    const mcap = ctx.metrics.marketCapitalization ?? ctx.quote.marketCap;
    const debt = debtOf(at(ctx.annualBalance, 0));
    return mcap != null && debt ? mcap / debt : null;
  }),
  R("Dividend Payout Ratio", ["user"], "recent", "percent", (ctx) => {
    const div = val(at(ctx.annualCash, 0), ...DIV_PAID);
    const ni = val(at(ctx.annualIncome, 0), ...NET);
    if (div !== null && ni) return (div / ni) * 100;
    return ctx.metrics.payoutRatio ?? null;
  }),
  R("Graham", ["user"], "recent", "currency", (ctx) => grahamNumber(ctx)),
  R("Price to Cash Flow", ["user"], "recent", "multiple", (ctx) => {
    const ocf = val(at(ctx.annualCash, 0), ...OCF);
    const shares = sharesOf(ctx);
    return ocf !== null && shares !== null && ctx.quote.price && ocf !== 0
      ? ctx.quote.price / (ocf / shares)
      : null;
  }),
  R("ROCE3yr avg", ["user"], "recent", "percent", (ctx) =>
    avgAnnual(roceAnnual, ctx, 3),
  ),
  R("PB X PE", ["user"], "recent", "multiple", (ctx) => {
    const pb = ctx.metrics.priceBook;
    const pe = ctx.metrics.trailingPe;
    return pb != null && pe != null ? pb * pe : null;
  }),
  R("NCAVPS", ["user"], "recent", "currency", (ctx) => {
    const ca = val(at(ctx.annualBalance, 0), ...CURR_A);
    const tl = val(at(ctx.annualBalance, 0), "totalLiab", "totalLiabilities");
    const shares = sharesOf(ctx);
    return ca !== null && tl !== null && shares !== null
      ? (ca - tl) / shares
      : null;
  }),
  R("Market Capt to Cash Flow", ["user"], "recent", "multiple", (ctx) => {
    const mcap = ctx.metrics.marketCapitalization ?? ctx.quote.marketCap;
    const ocf = val(at(ctx.annualCash, 0), ...OCF);
    return mcap != null && ocf ? mcap / ocf : null;
  }),
  R("Altman Z Score", ["user"], "recent", "number", (ctx) => altmanZ(ctx)),
  R("Market cap to quarterly profit", ["user"], "recent", "multiple", (ctx) => {
    const mcap = ctx.metrics.marketCapitalization ?? ctx.quote.marketCap;
    const q = qBack(ctx, 0, ...NET);
    return mcap != null && q ? mcap / q : null;
  }),
];

const ALL_RAW: readonly RawDef[] = [
  ...MOST_USED,
  ...ANNUAL_RECENT,
  ...ANNUAL_PRECEDING,
  ...ANNUAL_HISTORICAL,
  ...QUARTER_RECENT,
  ...QUARTER_PRECEDING,
  ...QUARTER_HISTORICAL,
  ...BALANCE_RECENT,
  ...BALANCE_PRECEDING,
  ...BALANCE_HISTORICAL,
  ...CASHFLOW_RECENT,
  ...CASHFLOW_PRECEDING,
  ...CASHFLOW_HISTORICAL,
  ...RATIOS_RECENT,
  ...RATIOS_PRECEDING,
  ...RATIOS_HISTORICAL,
  ...PRICE_RECENT,
  ...PRICE_HISTORICAL,
  ...USER_RECENT,
];

/** The catalog keyed by ratio id; shared labels across tabs stay one ratio. */
export const QUICK_RATIO_CATALOG: Readonly<Record<string, QuickRatioDef>> =
  (() => {
    const catalog: Record<string, QuickRatioDef> = {};
    for (const raw of ALL_RAW) {
      const id = slugify(raw.label);
      const existing = catalog[id];
      if (existing) {
        catalog[id] = {
          ...existing,
          tabs: [
            ...existing.tabs,
            ...raw.tabs.filter((t) => !existing.tabs.includes(t)),
          ],
        };
      } else {
        catalog[id] = {
          id,
          label: raw.label,
          tabs: [...raw.tabs],
          column: raw.column,
          unit: raw.unit,
          resolve: raw.resolve,
        };
      }
    }
    return catalog;
  })();

export const QUICK_RATIO_IDS: readonly string[] =
  Object.keys(QUICK_RATIO_CATALOG);

/** Screenshot-style summary defaults for a stock that never saved ratios. */
export const DEFAULT_QUICK_RATIOS: readonly string[] = [
  "market-capitalization",
  "current-price",
  "price-to-earning",
  "book-value",
  "dividend-yield",
  "return-on-capital-employed",
  "return-on-equity",
  "face-value",
  "eps",
].filter((id) => QUICK_RATIO_CATALOG[id] !== undefined);

export function normalizeQuickRatioSelection(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_QUICK_RATIOS];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = slugify(entry);
    if (QUICK_RATIO_CATALOG[id] !== undefined && !seen.has(id)) {
      seen.add(id);
    }
  }
  return seen.size > 0 ? [...seen] : [...DEFAULT_QUICK_RATIOS];
}

export function resolveQuickRatios(
  ids: readonly string[],
  ctx: QuickRatioContext,
): Record<string, number | null> {
  const values: Record<string, number | null> = {};
  for (const id of ids) {
    const def = QUICK_RATIO_CATALOG[id];
    if (!def) continue;
    try {
      const value = def.resolve(ctx);
      values[id] =
        typeof value === "number" && Number.isFinite(value) ? value : null;
    } catch {
      values[id] = null;
    }
  }
  return values;
}

export function resolveAllQuickRatios(
  ctx: QuickRatioContext,
): Record<string, number | null> {
  return resolveQuickRatios(QUICK_RATIO_IDS, ctx);
}

/**
 * Provider line-item names behind each canonical statement line, shared with
 * the statement-table builders so periodic tables and quick ratios read the
 * same fields.
 */
export const STATEMENT_FIELD_NAMES = {
  revenue: REV,
  grossProfit: GROSS,
  operatingIncome: OP_INC,
  netIncome: NET,
  otherIncome: OTHER_INC,
  profitBeforeTax: EBT,
  tax: TAX,
  interest: INTEREST,
  depreciation: DEP,
  materialCost: MAT_COST,
  employeeCost: EMP_COST,
  extraordinary: EXTRA,
  dividendsPaid: DIV_PAID,
  debt: DEBT,
  equity: EQUITY,
  currentAssets: CURR_A,
  currentLiabilities: CURR_L,
  inventory: INV,
  receivables: REC,
  cash: CASH,
  payables: PAYABLES,
  advancesFromCustomers: ADV_CUST,
  grossBlock: GROSS_BLOCK,
  accumulatedDepreciation: ACCUM_DEP,
  netBlock: NET_BLOCK,
  capitalWorkInProgress: CWIP,
  investments: INVEST,
  equityCapital: COMMON_CAP,
  retainedEarnings: RETAINED,
  totalAssets: TOTAL_A,
  operatingCashFlow: OCF,
  capitalExpenditure: CAPEX,
  investingCashFlow: ICF,
  financingCashFlow: FCF_FIN,
  netCashChange: NET_CHG,
  cashAtStart: CASH_BEG,
  cashAtEnd: CASH_END,
} as const;

export type StatementFieldKey = keyof typeof STATEMENT_FIELD_NAMES;
