import {
  STATEMENT_FIELD_NAMES,
  type PriceHistoryPoint,
  type StatementFieldKey,
} from "./quick-ratios";
import type { FinancialStatementPeriod } from "./types";

export type StatementValueKind = "currency" | "percent" | "multiple" | "number";

export interface StatementRow {
  readonly key: string;
  readonly label: string;
  readonly kind: StatementValueKind;
  readonly values: readonly (number | null)[];
}

export interface StatementTable {
  readonly id: string;
  readonly title: string;
  readonly periods: readonly string[];
  readonly rows: readonly StatementRow[];
}

export interface GrowthSummary {
  readonly salesGrowth10y: number | null;
  readonly salesGrowth5y: number | null;
  readonly salesGrowth3y: number | null;
  readonly salesGrowthTtm: number | null;
  readonly profitGrowth10y: number | null;
  readonly profitGrowth5y: number | null;
  readonly profitGrowth3y: number | null;
  readonly profitGrowthTtm: number | null;
  readonly priceCagr10y: number | null;
  readonly priceCagr5y: number | null;
  readonly priceCagr3y: number | null;
  readonly priceCagr1y: number | null;
  readonly roe10y: number | null;
  readonly roe5y: number | null;
  readonly roe3y: number | null;
  readonly roeLast: number | null;
}

const F = STATEMENT_FIELD_NAMES;

const line = (
  period: FinancialStatementPeriod | undefined,
  key: StatementFieldKey,
): number | null => {
  if (!period) return null;
  for (const name of F[key]) {
    const v = period.values[name];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
};

const growth = (
  current: number | null,
  previous: number | null,
): number | null => {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const cagr = (
  current: number | null,
  previous: number | null,
  years: number,
): number | null => {
  if (
    current === null ||
    previous === null ||
    previous <= 0 ||
    current <= 0 ||
    years <= 0
  ) {
    return null;
  }
  return (Math.pow(current / previous, 1 / years) - 1) * 100;
};

const sumQuarters = (
  quarters: readonly FinancialStatementPeriod[],
  start: number,
  count: number,
  key: StatementFieldKey,
): number | null => {
  let total = 0;
  let seen = 0;
  for (let i = start; i < start + count && i < quarters.length; i += 1) {
    const v = line(quarters[i], key);
    if (v !== null) {
      total += v;
      seen += 1;
    }
  }
  return seen > 0 ? total : null;
};

const debtOf = (
  period: FinancialStatementPeriod | undefined,
): number | null => {
  const direct = line(period, "debt");
  if (direct !== null) return direct;
  if (!period) return null;
  const shortT = period.values.shortTermDebt;
  const longT = period.values.longTermDebt;
  const s =
    typeof shortT === "number" && Number.isFinite(shortT) ? shortT : null;
  const l = typeof longT === "number" && Number.isFinite(longT) ? longT : null;
  if (s !== null || l !== null) return (s ?? 0) + (l ?? 0);
  return null;
};

const ebitOf = (
  period: FinancialStatementPeriod | undefined,
): number | null => {
  const ebt = line(period, "profitBeforeTax");
  const interest = line(period, "interest");
  if (ebt !== null && interest !== null) return ebt + interest;
  return line(period, "operatingIncome");
};

const ebitdaOf = (
  period: FinancialStatementPeriod | undefined,
): number | null => {
  const ebit = ebitOf(period);
  const dep = line(period, "depreciation");
  if (ebit !== null && dep !== null) return ebit + dep;
  return ebit;
};

const expensesOf = (
  period: FinancialStatementPeriod | undefined,
): number | null => {
  const rev = line(period, "revenue");
  const op = line(period, "operatingIncome");
  if (rev !== null && op !== null) return rev - op;
  return line(period, "materialCost");
};

const totalLiabilitiesOf = (
  period: FinancialStatementPeriod | undefined,
): number | null => {
  if (!period) return null;
  for (const name of [
    "totalLiab",
    "totalLiabilities",
    "totalLiabilitiesNetMinorityInterest",
  ]) {
    const v = period.values[name];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
};

export function periodLabel(date: string): string {
  const day = date.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 10);
  const month = parsed.toLocaleString("en-IN", {
    month: "short",
    timeZone: "UTC",
  });
  return `${month} ${parsed.getUTCFullYear()}`;
}

function closeAtOrBefore(
  history: readonly PriceHistoryPoint[],
  targetTs: number,
): number | null {
  let lo = 0;
  let hi = history.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (history[mid].ts <= targetTs) {
      best = history[mid].close;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

const periodEndTs = (date: string): number | null => {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
};

/** Latest period on/before `years` back from the newest period date. */
function anchorIndex(
  periods: readonly FinancialStatementPeriod[],
  yearsBack: number,
): number {
  if (periods.length === 0) return -1;
  const latest = periodEndTs(periods[0].date);
  if (latest === null) return -1;
  const target = latest - Math.round(yearsBack * 365.25 * 86400);
  for (let i = 0; i < periods.length; i += 1) {
    const ts = periodEndTs(periods[i].date);
    if (ts !== null && ts <= target) return i;
  }
  return -1;
}

const avg = (values: readonly (number | null)[]): number | null => {
  const finite = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (finite.length === 0) return null;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
};

const pick = (
  periods: readonly FinancialStatementPeriod[],
  index: number,
  key: StatementFieldKey,
): number | null => line(periods[index], key);

const roceAt = (
  income: readonly FinancialStatementPeriod[],
  balance: readonly FinancialStatementPeriod[],
  index: number,
): number | null => {
  const ebit = ebitOf(income[index]);
  const equity = line(balance[index], "equity");
  const debt = debtOf(balance[index]);
  const employed = equity !== null && debt !== null ? equity + debt : null;
  return ebit !== null && employed ? (ebit / employed) * 100 : null;
};

const roeAt = (
  income: readonly FinancialStatementPeriod[],
  balance: readonly FinancialStatementPeriod[],
  index: number,
): number | null => {
  const ni = line(income[index], "netIncome");
  const equity = line(balance[index], "equity");
  return ni !== null && equity ? (ni / equity) * 100 : null;
};

const opmAt = (
  income: readonly FinancialStatementPeriod[],
  index: number,
): number | null => {
  const op = line(income[index], "operatingIncome");
  const rev = line(income[index], "revenue");
  return op !== null && rev ? (op / rev) * 100 : null;
};

const epsAt = (
  income: readonly FinancialStatementPeriod[],
  index: number,
  shares: number | null,
): number | null => {
  const ni = line(income[index], "netIncome");
  return ni !== null && shares ? ni / shares : null;
};

interface TableArgs {
  readonly periods: readonly FinancialStatementPeriod[];
  readonly shares: number | null;
}

const row = (
  key: string,
  label: string,
  kind: StatementValueKind,
  values: readonly (number | null)[],
): StatementRow => ({ key, label, kind, values });

function incomeRows({ periods, shares }: TableArgs): StatementRow[] {
  return [
    row(
      "sales",
      "Sales",
      "currency",
      periods.map((p) => line(p, "revenue")),
    ),
    row(
      "expenses",
      "Expenses",
      "currency",
      periods.map((p) => expensesOf(p)),
    ),
    row(
      "operating-profit",
      "Operating Profit",
      "currency",
      periods.map((p) => line(p, "operatingIncome")),
    ),
    row(
      "opm",
      "OPM %",
      "percent",
      periods.map((_, i) => opmAt(periods, i)),
    ),
    row(
      "other-income",
      "Other Income",
      "currency",
      periods.map((p) => line(p, "otherIncome")),
    ),
    row(
      "interest",
      "Interest",
      "currency",
      periods.map((p) => line(p, "interest")),
    ),
    row(
      "depreciation",
      "Depreciation",
      "currency",
      periods.map((p) => line(p, "depreciation")),
    ),
    row(
      "profit-before-tax",
      "Profit before tax",
      "currency",
      periods.map((p) => line(p, "profitBeforeTax")),
    ),
    row(
      "tax-pct",
      "Tax %",
      "percent",
      periods.map((p) => {
        const tax = line(p, "tax");
        const ebt = line(p, "profitBeforeTax");
        return tax !== null && ebt ? (tax / ebt) * 100 : null;
      }),
    ),
    row(
      "net-profit",
      "Net Profit",
      "currency",
      periods.map((p) => line(p, "netIncome")),
    ),
    row(
      "eps",
      "EPS in Rs",
      "number",
      periods.map((_, i) => epsAt(periods, i, shares)),
    ),
  ];
}

/**
 * Quarterly results, newest quarter first in storage, oldest first on screen
 * (Screener order). Pass newest-first; display order is handled by callers via
 * `periods`/`values` reversal in `buildQuarterlyTable`.
 */
export function buildQuarterlyTable(
  quarterlyIncome: readonly FinancialStatementPeriod[],
  shares: number | null,
  count = 13,
): StatementTable {
  const sliced = quarterlyIncome.slice(0, Math.max(count, 1)).reverse();
  return {
    id: "quarterly",
    title: "Quarterly Results",
    periods: sliced.map((p) => periodLabel(p.date)),
    rows: incomeRows({ periods: sliced, shares }),
  };
}

export function buildProfitLossTable(
  annualIncome: readonly FinancialStatementPeriod[],
  shares: number | null,
): StatementTable {
  const periods = [...annualIncome].reverse();
  return {
    id: "profit-loss",
    title: "Profit & Loss",
    periods: periods.map((p) => periodLabel(p.date)),
    rows: incomeRows({ periods, shares }),
  };
}

export function buildBalanceSheetTable(
  annualBalance: readonly FinancialStatementPeriod[],
): StatementTable {
  const periods = [...annualBalance].reverse();
  const at = (i: number, key: StatementFieldKey): number | null =>
    pick(periods, i, key);
  const idx = periods.map((_, i) => i);
  const equity = idx.map((i) => at(i, "equity"));
  const debt = idx.map((i) => debtOf(periods[i]));
  const totalLiab = idx.map((i) => totalLiabilitiesOf(periods[i]));
  const otherLiab = idx.map((i) => {
    const t = totalLiab[i];
    const e = equity[i];
    const d = debt[i];
    return t !== null && e !== null && d !== null ? t - e - d : null;
  });
  const netBlock = idx.map((i) => at(i, "netBlock"));
  const cwip = idx.map((i) => at(i, "capitalWorkInProgress"));
  const invest = idx.map((i) => at(i, "investments"));
  const currA = idx.map((i) => at(i, "currentAssets"));
  const totalA = idx.map((i) => at(i, "totalAssets"));
  const otherAssets = idx.map((i) => {
    const t = totalA[i];
    const nb = netBlock[i];
    const cw = cwip[i];
    const iv = invest[i];
    const ca = currA[i];
    return t !== null &&
      nb !== null &&
      cw !== null &&
      iv !== null &&
      ca !== null
      ? t - nb - cw - iv - ca
      : null;
  });
  return {
    id: "balance-sheet",
    title: "Balance Sheet",
    periods: periods.map((p) => periodLabel(p.date)),
    rows: [
      row(
        "equity-capital",
        "Equity Capital",
        "currency",
        idx.map((i) => at(i, "equityCapital")),
      ),
      row(
        "reserves",
        "Reserves",
        "currency",
        idx.map((i) => at(i, "retainedEarnings")),
      ),
      row("borrowings", "Borrowings", "currency", debt),
      row("other-liabilities", "Other Liabilities", "currency", otherLiab),
      row("total-liabilities", "Total Liabilities", "currency", totalLiab),
      row("fixed-assets", "Fixed Assets", "currency", netBlock),
      row("cwip", "CWIP", "currency", cwip),
      row("investments", "Investments", "currency", invest),
      row("other-assets", "Other Assets", "currency", otherAssets),
      row("total-assets", "Total Assets", "currency", totalA),
    ],
  };
}

export function buildCashFlowTable(
  annualCash: readonly FinancialStatementPeriod[],
  annualIncome: readonly FinancialStatementPeriod[],
): StatementTable {
  const periods = [...annualCash].reverse();
  const fcf = periods.map((p) => {
    const direct = p.values.freeCashFlow;
    if (typeof direct === "number" && Number.isFinite(direct)) return direct;
    const ocf = line(p, "operatingCashFlow");
    const capex = line(p, "capitalExpenditure");
    if (ocf !== null && capex !== null) return ocf - Math.abs(capex);
    return ocf;
  });
  const cfoEbitda = periods.map((p) => {
    const ocf = line(p, "operatingCashFlow");
    const incomeByDate = annualIncome.find(
      (q) => q.date.slice(0, 10) === p.date.slice(0, 10),
    );
    const ebitda = ebitdaOf(incomeByDate);
    return ocf !== null && ebitda ? (ocf / ebitda) * 100 : null;
  });
  return {
    id: "cash-flow",
    title: "Cash Flows",
    periods: periods.map((p) => periodLabel(p.date)),
    rows: [
      row(
        "cfo",
        "Cash from Operating Activity",
        "currency",
        periods.map((p) => line(p, "operatingCashFlow")),
      ),
      row(
        "cfi",
        "Cash from Investing Activity",
        "currency",
        periods.map((p) => line(p, "investingCashFlow")),
      ),
      row(
        "cff",
        "Cash from Financing Activity",
        "currency",
        periods.map((p) => line(p, "financingCashFlow")),
      ),
      row(
        "net-cash",
        "Net Cash Flow",
        "currency",
        periods.map((p) => line(p, "netCashChange")),
      ),
      row("free-cash", "Free Cash Flow", "currency", fcf),
      row("cfo-ebitda", "CFO/EBITDA %", "percent", cfoEbitda),
    ],
  };
}

export interface RatiosTableInput {
  readonly income: readonly FinancialStatementPeriod[];
  readonly balance: readonly FinancialStatementPeriod[];
  readonly cash: readonly FinancialStatementPeriod[];
  readonly shares: number | null;
  readonly history: readonly PriceHistoryPoint[];
}

export function buildRatiosTable(input: RatiosTableInput): StatementTable {
  const count = Math.min(input.income.length, input.balance.length);
  // Oldest period first on screen (Screener order).
  const order = Array.from({ length: count }, (_, i) => count - 1 - i);
  const atInc = (i: number): FinancialStatementPeriod | undefined =>
    input.income[order[i]];
  const atBal = (i: number): FinancialStatementPeriod | undefined =>
    input.balance[order[i]];
  const seq = order.map((_, i) => i);
  const debtorDays = seq.map((i) => {
    const rec = line(atBal(i), "receivables");
    const rev = line(atInc(i), "revenue");
    return rec !== null && rev ? (rec / rev) * 365 : null;
  });
  const cogsOf = (i: number): number | null =>
    line(atInc(i), "materialCost") ?? line(atInc(i), "revenue");
  const invDays = seq.map((i) => {
    const inv = line(atBal(i), "inventory");
    const cogs = cogsOf(i);
    return inv !== null && cogs ? (inv / cogs) * 365 : null;
  });
  const payDays = seq.map((i) => {
    const pay = line(atBal(i), "payables");
    const cogs = cogsOf(i);
    return pay !== null && cogs ? (pay / cogs) * 365 : null;
  });
  const ccc = seq.map((i) =>
    debtorDays[i] !== null && invDays[i] !== null && payDays[i] !== null
      ? (debtorDays[i] as number) +
        (invDays[i] as number) -
        (payDays[i] as number)
      : null,
  );
  const wcDays = seq.map((i) => {
    const a = line(atBal(i), "currentAssets");
    const l = line(atBal(i), "currentLiabilities");
    const rev = line(atInc(i), "revenue");
    return a !== null && l !== null && rev ? ((a - l) / rev) * 365 : null;
  });
  const periods = order.map((k) => input.income[k]);
  return {
    id: "ratios",
    title: "Ratios",
    periods: periods.map((p) => periodLabel(p.date)),
    rows: [
      row("debtor-days", "Debtor Days", "number", debtorDays),
      row("inventory-days", "Inventory Days", "number", invDays),
      row("payable-days", "Days Payable", "number", payDays),
      row("ccc", "Cash Conversion Cycle", "number", ccc),
      row("wc-days", "Working Capital Days", "number", wcDays),
      row(
        "roce",
        "ROCE %",
        "percent",
        seq.map((i) => roceAt(input.income, input.balance, order[i])),
      ),
      row(
        "roe",
        "ROE %",
        "percent",
        seq.map((i) => roeAt(input.income, input.balance, order[i])),
      ),
      row(
        "roa",
        "ROA %",
        "percent",
        seq.map((i) => {
          const ni = line(atInc(i), "netIncome");
          const ta = line(atBal(i), "totalAssets");
          return ni !== null && ta ? (ni / ta) * 100 : null;
        }),
      ),
      row(
        "debt-equity",
        "Debt to Equity",
        "multiple",
        seq.map((i) => {
          const d = debtOf(atBal(i));
          const e = line(atBal(i), "equity");
          return d !== null && e ? d / e : null;
        }),
      ),
      row(
        "current-ratio",
        "Current Ratio",
        "multiple",
        seq.map((i) => {
          const a = line(atBal(i), "currentAssets");
          const l = line(atBal(i), "currentLiabilities");
          return a !== null && l ? a / l : null;
        }),
      ),
      row(
        "interest-cover",
        "Interest Coverage",
        "multiple",
        seq.map((i) => {
          const ebit = ebitOf(atInc(i));
          const interest = line(atInc(i), "interest");
          return ebit !== null && interest ? ebit / interest : null;
        }),
      ),
      row(
        "pe",
        "P/E",
        "multiple",
        seq.map((i) => {
          const period = atInc(i);
          const ts = period ? periodEndTs(period.date) : null;
          const price = ts === null ? null : closeAtOrBefore(input.history, ts);
          const eps = epsAt(input.income, order[i], input.shares);
          return price !== null && eps ? price / eps : null;
        }),
      ),
      row(
        "pb",
        "P/B",
        "multiple",
        seq.map((i) => {
          const period = atBal(i);
          const ts = period ? periodEndTs(period.date) : null;
          const price = ts === null ? null : closeAtOrBefore(input.history, ts);
          const equity = line(atBal(i), "equity");
          const bv =
            equity !== null && input.shares ? equity / input.shares : null;
          return price !== null && bv ? price / bv : null;
        }),
      ),
      row(
        "eps",
        "EPS in Rs",
        "number",
        seq.map((i) => epsAt(input.income, order[i], input.shares)),
      ),
      row(
        "bv",
        "Book Value in Rs",
        "currency",
        seq.map((i) => {
          const equity = line(atBal(i), "equity");
          return equity !== null && input.shares ? equity / input.shares : null;
        }),
      ),
    ],
  };
}

export interface GrowthSummaryInput {
  readonly annualIncome: readonly FinancialStatementPeriod[];
  readonly annualBalance: readonly FinancialStatementPeriod[];
  readonly quarterlyIncome: readonly FinancialStatementPeriod[];
  readonly history: readonly PriceHistoryPoint[];
  readonly price: number | null;
}

export function buildGrowthSummary(input: GrowthSummaryInput): GrowthSummary {
  const { annualIncome, annualBalance, quarterlyIncome, history, price } =
    input;
  const revAt = (i: number): number | null => line(annualIncome[i], "revenue");
  const niAt = (i: number): number | null => line(annualIncome[i], "netIncome");
  const revCagr = (years: number): number | null => {
    const i = anchorIndex(annualIncome, years);
    if (i < 0) return null;
    const spanYears =
      ((): number | null => {
        const a = periodEndTs(annualIncome[0].date);
        const b = periodEndTs(annualIncome[i].date);
        return a !== null && b !== null ? (a - b) / (365.25 * 86400) : null;
      })() ?? years;
    return cagr(revAt(0), revAt(i), spanYears);
  };
  const niCagr = (years: number): number | null => {
    const i = anchorIndex(annualIncome, years);
    if (i < 0) return null;
    const a = periodEndTs(annualIncome[0].date);
    const b = periodEndTs(annualIncome[i].date);
    const span = a !== null && b !== null ? (a - b) / (365.25 * 86400) : years;
    return cagr(niAt(0), niAt(i), span);
  };
  const ttmRev = sumQuarters(quarterlyIncome, 0, 4, "revenue");
  const ttmRevPrev = sumQuarters(quarterlyIncome, 4, 4, "revenue");
  const ttmNi = sumQuarters(quarterlyIncome, 0, 4, "netIncome");
  const ttmNiPrev = sumQuarters(quarterlyIncome, 4, 4, "netIncome");
  const priceCagr = (years: number): number | null => {
    if (price === null || history.length === 0) return null;
    const latest = history[history.length - 1].ts;
    const anchor = closeAtOrBefore(
      history,
      latest - Math.round(years * 365.25 * 86400),
    );
    return anchor !== null ? cagr(price, anchor, years) : null;
  };
  const roeAvg = (years: number): number | null => {
    const list: (number | null)[] = [];
    for (let i = 0; i < years; i += 1)
      list.push(roeAt(annualIncome, annualBalance, i));
    return avg(list);
  };
  return {
    salesGrowth10y: revCagr(10),
    salesGrowth5y: revCagr(5),
    salesGrowth3y: revCagr(3),
    salesGrowthTtm: growth(ttmRev, ttmRevPrev),
    profitGrowth10y: niCagr(10),
    profitGrowth5y: niCagr(5),
    profitGrowth3y: niCagr(3),
    profitGrowthTtm: growth(ttmNi, ttmNiPrev),
    priceCagr10y: priceCagr(10),
    priceCagr5y: priceCagr(5),
    priceCagr3y: priceCagr(3),
    priceCagr1y: priceCagr(1),
    roe10y: roeAvg(10),
    roe5y: roeAvg(5),
    roe3y: roeAvg(3),
    roeLast: roeAt(annualIncome, annualBalance, 0),
  };
}
