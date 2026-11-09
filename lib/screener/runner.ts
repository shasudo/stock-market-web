/**
 * Runs a scan over a universe of stocks: the result table, per-filter debug
 * counts, and the backtest history (how many stocks the scan would have
 * returned on each recent session). Pure — the universe is passed in — so it
 * is unit-tested without a database.
 */
import { createStockContext, ScanEvaluator, type StockContext, type StockData } from "./engine";
import { listClauses, type Group, type ResultColumn, type Scan } from "./scan-types";

export interface ScanResultRow {
  readonly symbol: string;
  readonly name: string;
  readonly exchange: string;
  readonly sector: string;
  readonly industry: string;
  readonly close: number | null;
  readonly pctChange: number | null;
  readonly volume: number | null;
  readonly columns: Readonly<Record<string, number | string | null>>;
  /** Last 60 daily closes, for the hover chart preview. */
  readonly spark: readonly number[];
}

export interface ScanRunResult {
  readonly rows: readonly ScanResultRow[];
  readonly scanned: number;
  readonly asOf: string | null;
  readonly elapsedMs: number;
}

const SPARK_LENGTH = 60;

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function dateOf(timestamp: number): string {
  return new Date(timestamp + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resultRow(
  evaluator: ScanEvaluator,
  columns: readonly ResultColumn[],
  asOf: number,
): ScanResultRow {
  const stock = evaluator.stock;
  const candle = stock.daily[asOf];
  const previous = stock.daily[asOf - 1];
  const values: Record<string, number | string | null> = {};
  for (const column of columns) {
    const first = column.expr.terms[0];
    const textual =
      first?.kind === "measure" &&
      ["symbol", "sector", "industry", "marketcap-name"].includes(first.measure);
    values[column.id] = textual
      ? evaluator.evaluateText(column.expr)
      : finiteOrNull(evaluator.evaluateExpr(column.expr));
  }
  return {
    symbol: stock.symbol,
    name: stock.name,
    exchange: stock.exchange,
    sector: stock.sector,
    industry: stock.industry,
    close: candle ? candle.close : null,
    pctChange:
      candle && previous && previous.close !== 0
        ? Number((((candle.close - previous.close) / previous.close) * 100).toFixed(2))
        : null,
    volume: candle?.volume ?? null,
    columns: values,
    spark: stock.daily
      .slice(Math.max(0, asOf - SPARK_LENGTH + 1), asOf + 1)
      .map((day) => day.close),
  };
}

export function runScan(stocks: readonly StockData[], scan: Scan): ScanRunResult {
  const started = Date.now();
  const rows: ScanResultRow[] = [];
  let latest = 0;
  for (const stock of stocks) {
    if (stock.daily.length === 0) continue;
    const evaluator = new ScanEvaluator(createStockContext(stock));
    if (!evaluator.evaluateGroup(scan.root)) continue;
    const asOf = stock.daily.length - 1;
    latest = Math.max(latest, stock.daily[asOf]!.timestamp);
    rows.push(resultRow(evaluator, scan.columns, asOf));
  }
  rows.sort((a, b) => (b.pctChange ?? -Infinity) - (a.pctChange ?? -Infinity));
  return {
    rows,
    scanned: stocks.length,
    asOf: latest ? dateOf(latest) : null,
    elapsedMs: Date.now() - started,
  };
}

export interface DebugCount {
  readonly passed: number;
  readonly total: number;
}

/** For each clause and group: how many stocks it passes on its own. */
export function debugScan(
  stocks: readonly StockData[],
  root: Group,
): Record<string, DebugCount> {
  const clauses = listClauses(root);
  const groups: Group[] = [];
  const walk = (group: Group): void => {
    groups.push(group);
    group.items.forEach((item) => item.kind === "group" && walk(item));
  };
  walk(root);

  const counts = new Map<string, number>();
  let total = 0;
  for (const stock of stocks) {
    if (stock.daily.length === 0) continue;
    total += 1;
    const evaluator = new ScanEvaluator(createStockContext(stock));
    for (const clause of clauses) {
      if (evaluator.evaluateClause(clause)) counts.set(clause.id, (counts.get(clause.id) ?? 0) + 1);
    }
    for (const group of groups) {
      if (evaluator.evaluateGroup(group)) counts.set(group.id, (counts.get(group.id) ?? 0) + 1);
    }
  }
  const out: Record<string, DebugCount> = {};
  for (const node of [...clauses, ...groups]) {
    out[node.id] = { passed: counts.get(node.id) ?? 0, total };
  }
  return out;
}

export interface BacktestDay {
  readonly date: string;
  readonly count: number;
  readonly sectors: Readonly<Record<string, number>>;
  readonly stocks: readonly { symbol: string; name: string; sector: string; close: number; pctChange: number | null }[];
}

export interface BacktestResult {
  readonly days: readonly BacktestDay[];
  readonly elapsedMs: number;
}

/** Index of the candle on `timestamp`'s IST date, or -1. Binary search. */
function indexOnDate(stock: StockData, date: string): number {
  const daily = stock.daily;
  let low = 0;
  let high = daily.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = dateOf(daily[mid]!.timestamp);
    if (candidate === date) return mid;
    if (candidate < date) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

/** The last `sessions` trading dates seen across the universe. */
export function recentSessions(stocks: readonly StockData[], sessions: number): string[] {
  const dates = new Map<string, number>();
  for (const stock of stocks) {
    const from = Math.max(0, stock.daily.length - sessions);
    for (let index = from; index < stock.daily.length; index += 1) {
      const date = dateOf(stock.daily[index]!.timestamp);
      dates.set(date, (dates.get(date) ?? 0) + 1);
    }
  }
  // A handful of thinly traded listings print on odd dates; a real session
  // has a good share of the universe trading.
  const busiest = Math.max(0, ...dates.values());
  const sorted = [...dates]
    .filter(([, count]) => count >= busiest * 0.2)
    .map(([date]) => date)
    .sort();
  return sorted.slice(-sessions);
}

export function backtestScan(
  stocks: readonly StockData[],
  scan: Scan,
  sessions: number,
): BacktestResult {
  const started = Date.now();
  const dates = recentSessions(stocks, sessions);
  const days = new Map<string, { count: number; sectors: Record<string, number>; stocks: BacktestDay["stocks"][number][] }>(
    dates.map((date) => [date, { count: 0, sectors: {}, stocks: [] }]),
  );
  const contexts: StockContext[] = stocks
    .filter((stock) => stock.daily.length > 0)
    .map(createStockContext);

  for (const context of contexts) {
    for (const date of dates) {
      const index = indexOnDate(context.stock, date);
      if (index < 0) continue;
      const evaluator = new ScanEvaluator(context, index);
      if (!evaluator.evaluateGroup(scan.root)) continue;
      const day = days.get(date)!;
      const stock = context.stock;
      const candle = stock.daily[index]!;
      const previous = stock.daily[index - 1];
      day.count += 1;
      const sector = stock.sector || "n/a";
      day.sectors[sector] = (day.sectors[sector] ?? 0) + 1;
      day.stocks.push({
        symbol: stock.symbol,
        name: stock.name,
        sector,
        close: candle.close,
        pctChange:
          previous && previous.close !== 0
            ? Number((((candle.close - previous.close) / previous.close) * 100).toFixed(2))
            : null,
      });
    }
  }

  return {
    days: dates.map((date) => {
      const day = days.get(date)!;
      day.stocks.sort((a, b) => (b.pctChange ?? -Infinity) - (a.pctChange ?? -Infinity));
      return { date, count: day.count, sectors: day.sectors, stocks: day.stocks };
    }),
    elapsedMs: Date.now() - started,
  };
}
