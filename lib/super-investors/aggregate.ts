import {
  changeSortValue,
  commonSortValue,
  investorSortValue,
  sortRows,
  type ChangeSortKey,
  type CommonSortKey,
  type InvestorSortKey,
  type SortState,
} from "./sorting";
import {
  investorSlug,
  SUPER_INVESTOR_CATEGORIES,
  type SuperInvestorCategory,
} from "./classify";

export interface FilingRecord {
  readonly id: string;
  readonly symbol: string;
  readonly companyName: string;
  readonly asOfDate: Date;
  readonly broadcastAt: Date;
}

export interface HolderRecord {
  readonly filingId: string;
  readonly category: string;
  readonly holderName: string;
  readonly investorKey: string;
  readonly investorName: string;
  readonly shares: number;
  readonly percent: number;
}

export type HoldingChange =
  "new" | "increased" | "decreased" | "unchanged" | "exited";

export interface SnapshotHolding {
  readonly symbol: string;
  readonly companyName: string;
  readonly category: SuperInvestorCategory;
  readonly asOfDate: Date;
  readonly broadcastAt: Date;
  readonly previousAsOfDate: Date | null;
  readonly shares: number;
  readonly percent: number;
  readonly previousShares: number | null;
  readonly previousPercent: number | null;
  /** null when the company has no earlier filing to compare against. */
  readonly change: HoldingChange | null;
  readonly filedNames: readonly string[];
}

export interface SnapshotInvestor {
  readonly key: string;
  readonly slug: string;
  readonly name: string;
  readonly holdings: readonly SnapshotHolding[];
}

export interface SuperInvestorSnapshot {
  readonly investors: ReadonlyMap<string, SnapshotInvestor>;
  readonly symbols: readonly string[];
  readonly latestAsOfDate: Date | null;
  readonly latestBroadcastAt: Date | null;
  readonly companyCount: number;
  readonly builtAt: Date;
}

/** Stake moves smaller than this (percentage points) count as unchanged. */
const STAKE_TOLERANCE_PP = 0.01;

interface CompanyFilings {
  readonly current: FilingRecord;
  readonly previous: FilingRecord | null;
}

/**
 * Latest and prior filing per company. A revised filing for the same as-of
 * date replaces the original (newest broadcast wins); the prior filing is the
 * newest one with an earlier as-of date.
 */
export function pickCompanyFilings(
  filings: readonly FilingRecord[],
): Map<string, CompanyFilings> {
  const bySymbol = new Map<string, FilingRecord[]>();
  for (const filing of filings) {
    const list = bySymbol.get(filing.symbol) ?? [];
    list.push(filing);
    bySymbol.set(filing.symbol, list);
  }

  const result = new Map<string, CompanyFilings>();
  for (const [symbol, list] of bySymbol) {
    list.sort(
      (a, b) =>
        b.asOfDate.getTime() - a.asOfDate.getTime() ||
        b.broadcastAt.getTime() - a.broadcastAt.getTime(),
    );
    const current = list[0]!;
    const previous =
      list.find(
        (filing) => filing.asOfDate.getTime() < current.asOfDate.getTime(),
      ) ?? null;
    result.set(symbol, { current, previous });
  }
  return result;
}

interface Position {
  shares: number;
  percent: number;
  category: SuperInvestorCategory;
  largestLine: number;
  name: string;
  readonly filedNames: Set<string>;
}

function isCategory(value: string): value is SuperInvestorCategory {
  return (SUPER_INVESTOR_CATEGORIES as readonly string[]).includes(value);
}

function collectPositions(
  holders: readonly HolderRecord[],
): Map<string, Map<string, Position>> {
  const byFiling = new Map<string, Map<string, Position>>();
  for (const holder of holders) {
    if (!isCategory(holder.category)) continue;
    const positions =
      byFiling.get(holder.filingId) ?? new Map<string, Position>();
    byFiling.set(holder.filingId, positions);
    const existing = positions.get(holder.investorKey);
    if (!existing) {
      positions.set(holder.investorKey, {
        shares: holder.shares,
        percent: holder.percent,
        category: holder.category,
        largestLine: holder.shares,
        name: holder.investorName,
        filedNames: new Set([holder.holderName]),
      });
      continue;
    }
    existing.shares += holder.shares;
    existing.percent += holder.percent;
    existing.filedNames.add(holder.holderName);
    if (holder.shares > existing.largestLine) {
      existing.largestLine = holder.shares;
      existing.category = holder.category;
      existing.name = holder.investorName;
    }
  }
  return byFiling;
}

export function classifyChange(
  currentPercent: number | null,
  previousPercent: number | null,
): HoldingChange {
  if (currentPercent === null) return "exited";
  if (previousPercent === null) return "new";
  const delta = currentPercent - previousPercent;
  if (delta > STAKE_TOLERANCE_PP) return "increased";
  if (delta < -STAKE_TOLERANCE_PP) return "decreased";
  return "unchanged";
}

export function buildSnapshot(
  filings: readonly FilingRecord[],
  holders: readonly HolderRecord[],
  builtAt: Date = new Date(),
): SuperInvestorSnapshot {
  const companies = pickCompanyFilings(filings);
  const positionsByFiling = collectPositions(holders);

  const investors = new Map<
    string,
    {
      key: string;
      name: string;
      nameWeight: number;
      holdings: SnapshotHolding[];
    }
  >();
  const addHolding = (
    key: string,
    name: string,
    weight: number,
    holding: SnapshotHolding,
  ) => {
    let investor = investors.get(key);
    if (!investor) {
      investor = { key, name, nameWeight: weight, holdings: [] };
      investors.set(key, investor);
    } else if (weight > investor.nameWeight) {
      investor.name = name;
      investor.nameWeight = weight;
    }
    investor.holdings.push(holding);
  };

  let latestAsOfDate: Date | null = null;
  let latestBroadcastAt: Date | null = null;

  for (const [symbol, { current, previous }] of companies) {
    if (
      isQuarterEnd(current.asOfDate) &&
      (!latestAsOfDate || current.asOfDate > latestAsOfDate)
    ) {
      latestAsOfDate = current.asOfDate;
    }
    if (!latestBroadcastAt || current.broadcastAt > latestBroadcastAt) {
      latestBroadcastAt = current.broadcastAt;
    }

    const now =
      positionsByFiling.get(current.id) ?? new Map<string, Position>();
    const before = previous
      ? (positionsByFiling.get(previous.id) ?? new Map<string, Position>())
      : null;

    for (const [key, position] of now) {
      const prior = before?.get(key) ?? null;
      addHolding(key, position.name, position.shares, {
        symbol,
        companyName: current.companyName,
        category: position.category,
        asOfDate: current.asOfDate,
        broadcastAt: current.broadcastAt,
        previousAsOfDate: previous?.asOfDate ?? null,
        shares: position.shares,
        percent: round4(position.percent),
        previousShares: prior?.shares ?? null,
        previousPercent: prior ? round4(prior.percent) : null,
        change:
          before === null
            ? null
            : classifyChange(position.percent, prior?.percent ?? null),
        filedNames: [...position.filedNames],
      });
    }

    if (before) {
      for (const [key, prior] of before) {
        if (now.has(key)) continue;
        addHolding(key, prior.name, 0, {
          symbol,
          companyName: current.companyName,
          category: prior.category,
          asOfDate: current.asOfDate,
          broadcastAt: current.broadcastAt,
          previousAsOfDate: previous!.asOfDate,
          shares: 0,
          percent: 0,
          previousShares: prior.shares,
          previousPercent: round4(prior.percent),
          change: "exited",
          filedNames: [...prior.filedNames],
        });
      }
    }
  }

  const finalInvestors = new Map<string, SnapshotInvestor>();
  for (const investor of investors.values()) {
    finalInvestors.set(investor.key, {
      key: investor.key,
      slug: investorSlug(investor.key),
      name: investor.name,
      holdings: investor.holdings,
    });
  }

  return {
    investors: finalInvestors,
    symbols: [...companies.keys()],
    latestAsOfDate,
    latestBroadcastAt,
    companyCount: companies.size,
    builtAt,
  };
}

/** Event-based filings (listing, buyback, merger) carry arbitrary dates; the headline quarter ignores them. */
export function isQuarterEnd(date: Date): boolean {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return (
    (month === 2 && day === 31) ||
    (month === 5 && day === 30) ||
    (month === 8 && day === 30) ||
    (month === 11 && day === 31)
  );
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

// ---------------------------------------------------------------------------
// Live views: the snapshot priced with the latest LiveQuote rows.

export interface LiveQuoteLite {
  readonly lastPrice: number;
  readonly netChange: number;
  readonly pctChange: number;
  readonly change3mPct: number | null;
  readonly sector: string;
  readonly industry: string;
  readonly syncedAt: Date;
}

export type QuoteLookup = ReadonlyMap<string, LiveQuoteLite>;

export interface InvestorSummary {
  readonly id: string;
  readonly name: string;
  readonly category: SuperInvestorCategory;
  readonly holdingsCount: number;
  readonly value: number;
  readonly dayChange: number;
  readonly dayChangePct: number | null;
  readonly topPerformer: {
    readonly symbol: string;
    readonly change3mPct: number;
  } | null;
  readonly newCount: number;
  readonly increasedCount: number;
  readonly decreasedCount: number;
  readonly exitedCount: number;
}

/** Fewer holdings than this and an investor is left out of the default list (search still finds them). */
export const DEFAULT_MIN_HOLDINGS: Readonly<
  Record<SuperInvestorCategory, number>
> = {
  promoter: 2,
  corporate: 2,
  angel: 1,
  public: 2,
  dii: 1,
  fii: 1,
};

function isHeld(holding: SnapshotHolding): boolean {
  return holding.change !== "exited" && holding.shares > 0;
}

export function summarizeInvestor(
  investor: SnapshotInvestor,
  category: SuperInvestorCategory,
  quotes: QuoteLookup,
): InvestorSummary | null {
  let holdingsCount = 0;
  let value = 0;
  let dayChange = 0;
  let newCount = 0;
  let increasedCount = 0;
  let decreasedCount = 0;
  let exitedCount = 0;
  let topPerformer: InvestorSummary["topPerformer"] = null;

  for (const holding of investor.holdings) {
    if (holding.category !== category) continue;
    if (holding.change === "exited") {
      exitedCount += 1;
      continue;
    }
    if (!isHeld(holding)) continue;
    holdingsCount += 1;
    if (holding.change === "new") newCount += 1;
    if (holding.change === "increased") increasedCount += 1;
    if (holding.change === "decreased") decreasedCount += 1;

    const quote = quotes.get(holding.symbol);
    if (!quote) continue;
    value += holding.shares * quote.lastPrice;
    dayChange += holding.shares * quote.netChange;
    if (
      quote.change3mPct !== null &&
      (topPerformer === null || quote.change3mPct > topPerformer.change3mPct)
    ) {
      topPerformer = { symbol: holding.symbol, change3mPct: quote.change3mPct };
    }
  }

  if (holdingsCount === 0) return null;
  const previousValue = value - dayChange;
  return {
    id: investor.slug,
    name: investor.name,
    category,
    holdingsCount,
    value,
    dayChange,
    dayChangePct: previousValue > 0 ? (dayChange / previousValue) * 100 : null,
    topPerformer,
    newCount,
    increasedCount,
    decreasedCount,
    exitedCount,
  };
}

export interface InvestorListResult {
  readonly investors: readonly InvestorSummary[];
  readonly total: number;
}

export function listInvestors(
  snapshot: SuperInvestorSnapshot,
  quotes: QuoteLookup,
  params: {
    readonly category: SuperInvestorCategory;
    readonly search?: string;
    readonly limit: number;
    readonly sort?: SortState<InvestorSortKey> | null;
  },
): InvestorListResult {
  const query = params.search?.trim().toUpperCase() ?? "";
  const minHoldings = query ? 1 : DEFAULT_MIN_HOLDINGS[params.category];
  const summaries: InvestorSummary[] = [];

  for (const investor of snapshot.investors.values()) {
    if (
      query &&
      !investor.key.includes(query) &&
      !investor.name.toUpperCase().includes(query)
    ) {
      continue;
    }
    const summary = summarizeInvestor(investor, params.category, quotes);
    if (summary && summary.holdingsCount >= minHoldings)
      summaries.push(summary);
  }

  summaries.sort(
    (a, b) => b.value - a.value || b.holdingsCount - a.holdingsCount,
  );
  const sorted = params.sort
    ? sortRows(summaries, (row) => investorSortValue(row, params.sort!.key), params.sort.dir)
    : summaries;
  return {
    investors: sorted.slice(0, params.limit),
    total: summaries.length,
  };
}

export interface InvestorHoldingView {
  readonly symbol: string;
  readonly companyName: string;
  readonly category: SuperInvestorCategory;
  readonly sector: string;
  readonly industry: string;
  readonly asOfDate: string;
  readonly previousAsOfDate: string | null;
  readonly shares: number;
  readonly percent: number;
  readonly previousShares: number | null;
  readonly previousPercent: number | null;
  readonly change: HoldingChange | null;
  readonly lastPrice: number | null;
  readonly dayChangePct: number | null;
  readonly change3mPct: number | null;
  readonly value: number | null;
  readonly dayChangeValue: number | null;
  readonly filedNames: readonly string[];
}

export interface InvestorDetail {
  readonly id: string;
  readonly name: string;
  readonly categories: readonly SuperInvestorCategory[];
  readonly totalValue: number;
  readonly dayChange: number;
  readonly dayChangePct: number | null;
  readonly holdingsCount: number;
  readonly exitedCount: number;
  readonly unpricedCount: number;
  readonly holdings: readonly InvestorHoldingView[];
}

export function buildInvestorDetail(
  investor: SnapshotInvestor,
  quotes: QuoteLookup,
): InvestorDetail {
  let totalValue = 0;
  let dayChange = 0;
  let holdingsCount = 0;
  let exitedCount = 0;
  let unpricedCount = 0;
  const categoryValue = new Map<SuperInvestorCategory, number>();

  const holdings = investor.holdings.map((holding): InvestorHoldingView => {
    const quote = quotes.get(holding.symbol) ?? null;
    const held = isHeld(holding);
    const value = quote && held ? holding.shares * quote.lastPrice : null;
    const dayChangeValue =
      quote && held ? holding.shares * quote.netChange : null;
    if (held) {
      holdingsCount += 1;
      if (value === null) unpricedCount += 1;
      categoryValue.set(
        holding.category,
        (categoryValue.get(holding.category) ?? 0) + (value ?? 0),
      );
    } else {
      exitedCount += 1;
    }
    totalValue += value ?? 0;
    dayChange += dayChangeValue ?? 0;

    return {
      symbol: holding.symbol,
      companyName: holding.companyName,
      category: holding.category,
      sector: quote?.sector ?? "-",
      industry: quote?.industry ?? "-",
      asOfDate: holding.asOfDate.toISOString(),
      previousAsOfDate: holding.previousAsOfDate?.toISOString() ?? null,
      shares: holding.shares,
      percent: holding.percent,
      previousShares: holding.previousShares,
      previousPercent: holding.previousPercent,
      change: holding.change,
      lastPrice: quote?.lastPrice ?? null,
      dayChangePct: quote?.pctChange ?? null,
      change3mPct: quote?.change3mPct ?? null,
      value,
      dayChangeValue,
      filedNames: holding.filedNames,
    };
  });

  holdings.sort(
    (a, b) => (b.value ?? -1) - (a.value ?? -1) || b.percent - a.percent,
  );
  const previousValue = totalValue - dayChange;
  return {
    id: investor.slug,
    name: investor.name,
    categories: [...categoryValue.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category),
    totalValue,
    dayChange,
    dayChangePct: previousValue > 0 ? (dayChange / previousValue) * 100 : null,
    holdingsCount,
    exitedCount,
    unpricedCount,
    holdings,
  };
}

export interface KeyChangeView {
  readonly investorId: string;
  readonly investorName: string;
  readonly category: SuperInvestorCategory;
  readonly symbol: string;
  readonly companyName: string;
  readonly change: Exclude<HoldingChange, "unchanged">;
  readonly asOfDate: string;
  readonly filedAt: string;
  readonly percent: number;
  readonly previousPercent: number | null;
  readonly shares: number;
  readonly previousShares: number | null;
  readonly lastPrice: number | null;
  readonly dayChangePct: number | null;
  readonly value: number | null;
}

/**
 * Quarter-on-quarter stake moves by the investors in a category's default
 * list, newest filings first.
 */
export function listKeyChanges(
  snapshot: SuperInvestorSnapshot,
  quotes: QuoteLookup,
  params: {
    readonly category: SuperInvestorCategory;
    readonly limit: number;
    readonly sort?: SortState<ChangeSortKey> | null;
  },
): KeyChangeView[] {
  const minHoldings = DEFAULT_MIN_HOLDINGS[params.category];
  const changes: KeyChangeView[] = [];

  for (const investor of snapshot.investors.values()) {
    const held = investor.holdings.filter(
      (holding) => holding.category === params.category && isHeld(holding),
    ).length;
    if (held < minHoldings) continue;

    for (const holding of investor.holdings) {
      if (holding.category !== params.category) continue;
      if (holding.change === null || holding.change === "unchanged") continue;
      const quote = quotes.get(holding.symbol) ?? null;
      const shares = holding.change === "exited" ? 0 : holding.shares;
      changes.push({
        investorId: investor.slug,
        investorName: investor.name,
        category: holding.category,
        symbol: holding.symbol,
        companyName: holding.companyName,
        change: holding.change,
        asOfDate: holding.asOfDate.toISOString(),
        filedAt: holding.broadcastAt.toISOString(),
        percent: holding.percent,
        previousPercent: holding.previousPercent,
        shares,
        previousShares: holding.previousShares,
        lastPrice: quote?.lastPrice ?? null,
        dayChangePct: quote?.pctChange ?? null,
        value: quote ? shares * quote.lastPrice : null,
      });
    }
  }

  changes.sort(
    (a, b) =>
      b.filedAt.localeCompare(a.filedAt) || (b.value ?? 0) - (a.value ?? 0),
  );
  const sorted = params.sort
    ? sortRows(changes, (row) => changeSortValue(row, params.sort!.key), params.sort.dir)
    : changes;
  return sorted.slice(0, params.limit);
}

export interface CommonStockView {
  readonly symbol: string;
  readonly companyName: string;
  readonly sector: string;
  readonly lastPrice: number | null;
  readonly dayChangePct: number | null;
  readonly holders: readonly {
    readonly id: string;
    readonly name: string;
    readonly percent: number;
  }[];
  readonly combinedPercent: number;
}

export function listCommonStocks(
  snapshot: SuperInvestorSnapshot,
  quotes: QuoteLookup,
  params: {
    readonly category: SuperInvestorCategory;
    readonly limit: number;
    readonly minHolders?: number;
    readonly sort?: SortState<CommonSortKey> | null;
  },
): CommonStockView[] {
  const minHoldings = DEFAULT_MIN_HOLDINGS[params.category];
  const bySymbol = new Map<
    string,
    {
      companyName: string;
      holders: { id: string; name: string; percent: number }[];
    }
  >();

  for (const investor of snapshot.investors.values()) {
    const held = investor.holdings.filter(
      (holding) => holding.category === params.category && isHeld(holding),
    );
    if (held.length < minHoldings) continue;
    for (const holding of held) {
      const entry = bySymbol.get(holding.symbol) ?? {
        companyName: holding.companyName,
        holders: [],
      };
      entry.holders.push({
        id: investor.slug,
        name: investor.name,
        percent: holding.percent,
      });
      bySymbol.set(holding.symbol, entry);
    }
  }

  const minHolders = params.minHolders ?? 2;
  const rows: CommonStockView[] = [];
  for (const [symbol, entry] of bySymbol) {
    if (entry.holders.length < minHolders) continue;
    const quote = quotes.get(symbol) ?? null;
    entry.holders.sort((a, b) => b.percent - a.percent);
    rows.push({
      symbol,
      companyName: entry.companyName,
      sector: quote?.sector ?? "-",
      lastPrice: quote?.lastPrice ?? null,
      dayChangePct: quote?.pctChange ?? null,
      holders: entry.holders,
      combinedPercent: round4(
        entry.holders.reduce((sum, holder) => sum + holder.percent, 0),
      ),
    });
  }

  rows.sort(
    (a, b) =>
      b.holders.length - a.holders.length ||
      b.combinedPercent - a.combinedPercent,
  );
  const sorted = params.sort
    ? sortRows(rows, (row) => commonSortValue(row, params.sort!.key), params.sort.dir)
    : rows;
  return sorted.slice(0, params.limit);
}
