import { buildDateWindows } from "./nse-shareholding-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 31;

/**
 * Earliest submission date the history reaches back to. NSE has XBRL for
 * almost every shareholding filing from the Jun-2021 quarter on; before that
 * coverage is patchy.
 */
export const HISTORY_START = new Date(Date.UTC(2021, 6, 1));

/** `months` consecutive ~31-day windows ending the day before `reached`, clipped at HISTORY_START. */
export function buildBackfillWindows(
  reached: Date,
  months: number,
): { from: Date; to: Date }[] {
  const end = new Date(reached.getTime() - DAY_MS);
  const totalDays = Math.min(
    months * WINDOW_DAYS,
    Math.ceil((end.getTime() - HISTORY_START.getTime()) / DAY_MS) + 1,
  );
  if (totalDays <= 0) return [];
  return buildDateWindows(end, totalDays, WINDOW_DAYS).map((window) => ({
    from:
      window.from.getTime() < HISTORY_START.getTime()
        ? HISTORY_START
        : window.from,
    to: window.to,
  }));
}

export interface HistoryFilingRecord {
  readonly id: string;
  readonly symbol: string;
  readonly companyName: string;
  readonly asOfDate: Date;
  readonly broadcastAt: Date;
}

export interface HistoryHolderRecord {
  readonly filingId: string;
  readonly category: string;
  readonly shares: number;
  readonly percent: number;
}

export interface StakeHistoryCell {
  readonly percent: number;
  readonly shares: number;
}

export interface StakeHistoryRow {
  readonly symbol: string;
  readonly companyName: string;
  readonly category: string;
  /** Aligned with `quarters`: a stake, null when the company filed without naming this investor, or "not-filed". */
  readonly cells: readonly (StakeHistoryCell | null | "not-filed")[];
  /** Still named in the company's newest quarter-end filing. */
  readonly held: boolean;
  readonly firstQuarter: string;
  readonly lastQuarter: string;
}

export interface StakeHistoryQuarter {
  readonly asOfDate: string;
  readonly holdingsCount: number;
  readonly entered: number;
  readonly exited: number;
}

export interface StakeHistory {
  /** Quarter-end dates, newest first. */
  readonly quarters: readonly StakeHistoryQuarter[];
  readonly rows: readonly StakeHistoryRow[];
}

function isQuarterEndDate(date: Date): boolean {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return (
    (month === 2 && day === 31) ||
    (month === 5 && day === 30) ||
    (month === 8 && day === 30) ||
    (month === 11 && day === 31)
  );
}

/**
 * Quarter-by-quarter stake matrix for one investor. Only quarter-end filings
 * count (event-dated ones would add odd columns), and within a quarter the
 * newest revision wins. Columns run from the first quarter the investor shows
 * up anywhere to the newest quarter any of their companies has filed.
 */
export function buildStakeHistory(
  filings: readonly HistoryFilingRecord[],
  holders: readonly HistoryHolderRecord[],
): StakeHistory {
  const latestFiling = new Map<string, HistoryFilingRecord>();
  for (const filing of filings) {
    if (!isQuarterEndDate(filing.asOfDate)) continue;
    const key = `${filing.symbol}|${filing.asOfDate.toISOString()}`;
    const existing = latestFiling.get(key);
    if (!existing || filing.broadcastAt > existing.broadcastAt)
      latestFiling.set(key, filing);
  }

  const positions = new Map<
    string,
    { shares: number; percent: number; category: string; largest: number }
  >();
  for (const holder of holders) {
    const position = positions.get(holder.filingId);
    if (!position) {
      positions.set(holder.filingId, {
        shares: holder.shares,
        percent: holder.percent,
        category: holder.category,
        largest: holder.shares,
      });
    } else {
      position.shares += holder.shares;
      position.percent += holder.percent;
      if (holder.shares > position.largest) {
        position.largest = holder.shares;
        position.category = holder.category;
      }
    }
  }

  const bySymbol = new Map<
    string,
    Map<
      string,
      {
        filing: HistoryFilingRecord;
        cell: StakeHistoryCell | null;
        category: string | null;
      }
    >
  >();
  let firstHeld: string | null = null;
  for (const filing of latestFiling.values()) {
    const iso = filing.asOfDate.toISOString();
    const position = positions.get(filing.id) ?? null;
    const quarters = bySymbol.get(filing.symbol) ?? new Map();
    bySymbol.set(filing.symbol, quarters);
    quarters.set(iso, {
      filing,
      cell:
        position && position.shares > 0
          ? {
              shares: position.shares,
              percent: Math.round(position.percent * 10_000) / 10_000,
            }
          : null,
      category: position?.category ?? null,
    });
    if (
      position &&
      position.shares > 0 &&
      (firstHeld === null || iso < firstHeld)
    )
      firstHeld = iso;
  }
  if (firstHeld === null) return { quarters: [], rows: [] };

  const quarterSet = new Set<string>();
  for (const quarters of bySymbol.values()) {
    for (const iso of quarters.keys())
      if (iso >= firstHeld) quarterSet.add(iso);
  }
  const quarterList = [...quarterSet].sort((a, b) => b.localeCompare(a));

  const rows: StakeHistoryRow[] = [];
  for (const [symbol, quarters] of bySymbol) {
    const heldQuarters = [...quarters.entries()]
      .filter(([, entry]) => entry.cell !== null)
      .map(([iso]) => iso)
      .sort();
    if (heldQuarters.length === 0) continue;
    const newest = [...quarters.keys()].sort().at(-1)!;
    const newestEntry = quarters.get(newest)!;
    const latestCategory =
      [...quarters.entries()]
        .filter(([, entry]) => entry.category !== null)
        .sort(([a], [b]) => b.localeCompare(a))[0]?.[1].category ?? "public";
    rows.push({
      symbol,
      companyName: newestEntry.filing.companyName,
      category: latestCategory,
      cells: quarterList.map((iso) => {
        const entry = quarters.get(iso);
        return entry ? entry.cell : "not-filed";
      }),
      held: newestEntry.cell !== null,
      firstQuarter: heldQuarters[0]!,
      lastQuarter: heldQuarters.at(-1)!,
    });
  }

  rows.sort((a, b) => {
    if (a.held !== b.held) return a.held ? -1 : 1;
    if (!a.held)
      return (
        b.lastQuarter.localeCompare(a.lastQuarter) ||
        a.companyName.localeCompare(b.companyName)
      );
    const stake = (row: StakeHistoryRow) => {
      const cell = row.cells.find(
        (value): value is StakeHistoryCell =>
          value !== null && value !== "not-filed",
      );
      return cell?.percent ?? 0;
    };
    return stake(b) - stake(a);
  });

  const quarters: StakeHistoryQuarter[] = quarterList.map((asOfDate, index) => {
    let holdingsCount = 0;
    let entered = 0;
    let exited = 0;
    for (const row of rows) {
      const now = row.cells[index];
      const before = row.cells[index + 1];
      if (now && now !== "not-filed") holdingsCount += 1;
      if (before === undefined) continue;
      const heldNow = Boolean(now && now !== "not-filed");
      const heldBefore = Boolean(before && before !== "not-filed");
      if (now === "not-filed" || before === "not-filed") continue;
      if (heldNow && !heldBefore) entered += 1;
      if (!heldNow && heldBefore) exited += 1;
    }
    return { asOfDate, holdingsCount, entered, exited };
  });

  return { quarters, rows };
}
