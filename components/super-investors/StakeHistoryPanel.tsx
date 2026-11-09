"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { nextSort, sortRows, type SortState } from "@/lib/super-investors/sorting";
import { SortableTh } from "./SortableTh";
import { Search } from "lucide-react";
import {
  fetchSuperInvestorHistory,
  getSuperInvestorErrorMessage,
  isAbortError,
  type InvestorHistoryResponse,
  type StakeHistoryCell,
  type StakeHistoryRow,
} from "@/lib/super-investors/client";
import {
  SUPER_INVESTOR_CATEGORY_LABELS,
  type SuperInvestorCategory,
} from "@/lib/super-investors/classify";
import { formatShares } from "./format";

type Mode = "percent" | "shares";

function quarterLabel(iso: string): { month: string; year: string } {
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString("en-IN", {
      month: "short",
      timeZone: "UTC",
    }),
    year: String(date.getUTCFullYear()),
  };
}

function isStake(
  value: StakeHistoryCell | null | "not-filed" | undefined,
): value is StakeHistoryCell {
  return value !== null && value !== undefined && value !== "not-filed";
}

function compactShares(shares: number): string {
  if (shares >= 1e7) return `${(shares / 1e7).toFixed(2)} Cr`;
  if (shares >= 1e5) return `${(shares / 1e5).toFixed(2)} L`;
  return formatShares(shares);
}

/** Older quarter is the next cell (columns run newest first). */
function cellTone(row: StakeHistoryRow, index: number): string {
  const now = row.cells[index];
  const before = row.cells[index + 1];
  if (!isStake(now)) return "text-muted-foreground";
  if (before === null) return "text-success font-extrabold";
  if (!isStake(before)) return "text-foreground";
  const delta = now.percent - before.percent;
  if (delta > 0.01) return "text-success";
  if (delta < -0.01) return "text-error";
  return "text-foreground";
}

export function StakeHistoryPanel({
  investorId,
}: {
  readonly investorId: string;
}) {
  const [state, setState] = useState<{
    id: string | null;
    data: InvestorHistoryResponse | null;
    error: unknown;
  }>({ id: null, data: null, error: null });
  const [mode, setMode] = useState<Mode>("percent");
  const [showExited, setShowExited] = useState(true);
  const [search, setSearch] = useState("");
  /** "company", or a quarter's asOfDate to sort by that quarter's stake. */
  const [sort, setSort] = useState<SortState<string> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      try {
        const data = await fetchSuperInvestorHistory(
          investorId,
          controller.signal,
        );
        setState({ id: investorId, data, error: null });
      } catch (error: unknown) {
        if (isAbortError(error) || controller.signal.aborted) return;
        setState({ id: investorId, data: null, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [investorId]);

  const data = state.id === investorId ? state.data : null;
  const error = state.id === investorId ? state.error : null;
  const history = data?.history ?? null;

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (history?.rows ?? []).filter((row) => {
      if (!showExited && !row.held) return false;
      return (
        !query ||
        row.symbol.toLowerCase().includes(query) ||
        row.companyName.toLowerCase().includes(query)
      );
    });
    if (!sort || !history) return filtered;
    if (sort.key === "company") {
      return sortRows(filtered, (row) => row.companyName, sort.dir);
    }
    const index = history.quarters.findIndex((quarter) => quarter.asOfDate === sort.key);
    if (index < 0) return filtered;
    return sortRows(
      filtered,
      (row) => {
        const cell = row.cells[index];
        if (!isStake(cell)) return null;
        return mode === "percent" ? cell.percent : cell.shares;
      },
      sort.dir,
    );
  }, [history, search, showExited, sort, mode]);
  const onSort = (key: string): void =>
    setSort((current) => nextSort(current, key, key === "company"));

  if (!data && !error) {
    return (
      <div className="rounded-2xl border border-border/90 bg-card p-16 text-center text-xs text-muted-foreground">
        Loading quarterly history…
      </div>
    );
  }
  if (!history || history.quarters.length === 0) {
    return (
      <div className="rounded-2xl border border-border/90 bg-card p-16 text-center text-xs text-muted-foreground">
        {error
          ? getSuperInvestorErrorMessage(error)
          : "No quarter-end filings name this investor yet."}
      </div>
    );
  }

  const quarters = history.quarters;
  const maxCount = Math.max(
    1,
    ...quarters.map((quarter) => quarter.holdingsCount),
  );
  const exitedCount = history.rows.filter((row) => !row.held).length;
  const timeline = [...quarters].reverse();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/90 bg-card p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Companies held each quarter
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {history.rows.length} companies since{" "}
            {quarterLabel(quarters.at(-1)!.asOfDate).month}{" "}
            {quarterLabel(quarters.at(-1)!.asOfDate).year} · {exitedCount} since
            exited or below 1%
          </span>
        </div>
        <div className="flex h-28 items-end gap-1 overflow-x-auto scrollbar-thin pb-1">
          {timeline.map((quarter) => {
            const label = quarterLabel(quarter.asOfDate);
            return (
              <div
                key={quarter.asOfDate}
                className="group flex min-w-[34px] flex-1 flex-col items-center justify-end gap-1"
                title={`${label.month} ${label.year}: ${quarter.holdingsCount} companies · ${quarter.entered} entered · ${quarter.exited} exited`}
              >
                <span className="font-mono text-[10px] font-bold text-foreground num-font">
                  {quarter.holdingsCount}
                </span>
                <div
                  className="w-full rounded-t-md bg-primary/70 transition-colors group-hover:bg-primary"
                  style={{
                    height: `${Math.max(4, (quarter.holdingsCount / maxCount) * 64)}px`,
                  }}
                />
                <span className="whitespace-nowrap text-[9px] font-semibold text-muted-foreground">
                  {label.month} {label.year.slice(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/80 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter company..."
              className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              {(["percent", "shares"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${
                    mode === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {value === "percent" ? "Stake %" : "Shares"}
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
              <input
                type="checkbox"
                checked={showExited}
                onChange={(event) => setShowExited(event.target.checked)}
                className="accent-primary"
              />
              Include past holdings
            </label>
          </div>
        </div>
        <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
          As filed at each quarter end.{" "}
          <span className="text-success">Green</span> = stake up,{" "}
          <span className="text-error">red</span> = down,{" "}
          <span className="font-extrabold text-success">bold</span> = first
          appearance. A blank cell means the filing didn&apos;t name them (not
          held, or under 1%); “·” means no filing for that quarter on record
          (SME companies file half-yearly; BSE-only companies are covered from
          Nov 2026, and years before an NSE listing aren&apos;t available).
        </p>
        <div className="max-h-[70vh] overflow-auto scrollbar-thin">
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                <SortableTh
                  label="Company"
                  sortKey="company"
                  sort={sort}
                  onSort={onSort}
                  className="sticky left-0 z-30 min-w-[180px] border-b border-border bg-muted px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                />
                {quarters.map((quarter) => {
                  const label = quarterLabel(quarter.asOfDate);
                  return (
                    <SortableTh
                      key={quarter.asOfDate}
                      label={
                        <span className="flex flex-col items-end leading-tight">
                          <span>{label.month}</span>
                          <span className="text-foreground">{label.year}</span>
                        </span>
                      }
                      sortKey={quarter.asOfDate}
                      sort={sort}
                      onSort={onSort}
                      align="right"
                      className="whitespace-nowrap border-b border-border bg-muted px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={quarters.length + 1}
                    className="px-4 py-12 text-center text-xs text-muted-foreground"
                  >
                    No companies match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.symbol}
                    className={`group ${row.held ? "" : "opacity-60"}`}
                  >
                    <td className="sticky left-0 z-10 border-b border-border/70 bg-card px-3.5 py-2 group-hover:bg-muted">
                      <Link
                        href={`/stock/${encodeURIComponent(row.symbol)}`}
                        className="block max-w-[220px] truncate font-bold text-foreground hover:text-primary hover:underline"
                        title={row.companyName}
                      >
                        {row.companyName}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        {row.symbol}
                        {row.category !== "public" &&
                        (
                          Object.keys(
                            SUPER_INVESTOR_CATEGORY_LABELS,
                          ) as string[]
                        ).includes(row.category)
                          ? ` · ${SUPER_INVESTOR_CATEGORY_LABELS[row.category as SuperInvestorCategory]}`
                          : ""}
                        {row.held ? "" : " · exited"}
                      </div>
                    </td>
                    {row.cells.map((cell, index) => (
                      <td
                        key={quarters[index]!.asOfDate}
                        title={
                          isStake(cell)
                            ? `${formatShares(cell.shares)} shares · ${cell.percent.toFixed(2)}%`
                            : undefined
                        }
                        className={`whitespace-nowrap border-b border-border/70 px-2.5 py-2 text-right font-mono num-font group-hover:bg-muted/60 ${cellTone(row, index)}`}
                      >
                        {cell === "not-filed" ? (
                          <span className="text-muted-foreground/50">·</span>
                        ) : cell === null ? (
                          ""
                        ) : mode === "percent" ? (
                          cell.percent.toFixed(2)
                        ) : (
                          compactShares(cell.shares)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
