"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { usePolledResource } from "@/lib/hooks/usePolledResource";
import {
  fetchSuperInvestor,
  getSuperInvestorErrorMessage,
  SUPER_INVESTORS_POLL_MS,
  type InvestorHoldingView,
} from "@/lib/super-investors/client";
import { SUPER_INVESTOR_CATEGORY_LABELS } from "@/lib/super-investors/classify";
import {
  changeRank,
  dealSortValue,
  nextSort,
  sortRows,
  type DealSortKey,
  type SortState,
} from "@/lib/super-investors/sorting";
import { SortableTh } from "./SortableTh";
import {
  avatarColor,
  CHANGE_LABELS,
  changeBadgeClass,
  formatCrores,
  formatDate,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedCrores,
  formatSignedPercent,
  initials,
  toneClass,
} from "./format";
import { LiveStatus } from "./LiveStatus";
import { StakeHistoryPanel } from "./StakeHistoryPanel";

type SortKey =
  | "companyName"
  | "sector"
  | "shares"
  | "percent"
  | "change"
  | "lastPrice"
  | "dayChangePct"
  | "value"
  | "dayChangeValue";

type Section = "holdings" | "history" | "deals";

const SECTIONS: readonly { id: Section; label: string }[] = [
  { id: "holdings", label: "Current holdings" },
  { id: "history", label: "Stake history (quarterly)" },
  { id: "deals", label: "Bulk / block deals" },
];

function sortValue(row: InvestorHoldingView, key: SortKey): number | string | null {
  switch (key) {
    case "companyName":
      return row.companyName;
    case "sector":
      return row.sector === "-" ? null : row.sector;
    case "change":
      return changeRank(row.change);
    default:
      return row[key] ?? null;
  }
}

const DEAL_COLUMNS: readonly { key: DealSortKey; label: string; align: "left" | "right" }[] = [
  { key: "date", label: "Date", align: "left" },
  { key: "stock", label: "Company", align: "left" },
  { key: "deal", label: "Deal", align: "left" },
  { key: "quantity", label: "Quantity", align: "right" },
  { key: "dealPrice", label: "Price", align: "right" },
  { key: "dealValue", label: "Deal Value", align: "right" },
  { key: "livePrice", label: "Live Price", align: "right" },
];

const COLUMNS: readonly {
  key: SortKey;
  label: string;
  align: "left" | "right" | "center";
}[] = [
  { key: "companyName", label: "Company", align: "left" },
  { key: "sector", label: "Sector", align: "left" },
  { key: "shares", label: "Shares Held", align: "right" },
  { key: "percent", label: "Stake %", align: "right" },
  { key: "change", label: "QoQ Change", align: "center" },
  { key: "lastPrice", label: "Price", align: "right" },
  { key: "dayChangePct", label: "Day %", align: "right" },
  { key: "value", label: "Holding Value", align: "right" },
  { key: "dayChangeValue", label: "Day P&L", align: "right" },
];

export function SuperInvestorDetail({
  investorId,
  onBack,
}: {
  readonly investorId: string;
  readonly onBack: () => void;
}) {
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchSuperInvestor(investorId, signal),
    [investorId],
  );
  const { data, error, loading, refreshing, updatedAt } = usePolledResource(
    investorId,
    fetcher,
    SUPER_INVESTORS_POLL_MS,
  );
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "value", dir: "desc" });
  const [dealSort, setDealSort] = useState<SortState<DealSortKey>>({ key: "date", dir: "desc" });
  const [search, setSearch] = useState("");
  const [showExited, setShowExited] = useState(true);
  const [section, setSection] = useState<Section>("holdings");

  const rows = useMemo(() => {
    const holdings = data?.investor.holdings ?? [];
    const query = search.trim().toLowerCase();
    const filtered = holdings.filter((row) => {
      if (!showExited && row.change === "exited") return false;
      if (!query) return true;
      return (
        row.symbol.toLowerCase().includes(query) ||
        row.companyName.toLowerCase().includes(query) ||
        row.sector.toLowerCase().includes(query)
      );
    });
    return sortRows(filtered, (row) => sortValue(row, sort.key), sort.dir);
  }, [data, search, showExited, sort]);
  const deals = useMemo(
    () => sortRows(data?.deals ?? [], (deal) => dealSortValue(deal, dealSort.key), dealSort.dir),
    [data, dealSort],
  );

  const investor = data?.investor ?? null;
  const counts = useMemo(() => {
    const result = { new: 0, increased: 0, decreased: 0, exited: 0 };
    for (const holding of investor?.holdings ?? []) {
      if (holding.change && holding.change in result) {
        result[holding.change as keyof typeof result] += 1;
      }
    }
    return result;
  }, [investor]);
  const asOfDate = investor?.holdings[0]?.asOfDate ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All investors
        </button>
        <LiveStatus
          refreshing={refreshing}
          updatedAt={updatedAt}
          quotesSyncedAt={data?.meta.quotesSyncedAt ?? null}
        />
      </div>

      {loading && !investor ? (
        <div className="rounded-2xl border border-border/90 bg-card p-16 text-center text-xs text-muted-foreground">
          Loading portfolio…
        </div>
      ) : !investor ? (
        <div className="rounded-2xl border border-border/90 bg-card p-16 text-center text-xs text-error">
          {getSuperInvestorErrorMessage(error)}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border/90 bg-card p-5 shadow-xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: avatarColor(investor.id) }}
                >
                  {initials(investor.name)}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
                    {investor.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {investor.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-lg border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {SUPER_INVESTOR_CATEGORY_LABELS[category]}
                      </span>
                    ))}
                    <span className="text-[11px] text-muted-foreground">
                      Holdings as on {formatDate(asOfDate)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label="Portfolio value (live)"
                value={formatCrores(investor.totalValue)}
              />
              <Stat
                label="Day change"
                value={formatSignedCrores(investor.dayChange)}
                sub={formatSignedPercent(investor.dayChangePct)}
                tone={investor.dayChange}
              />
              <Stat
                label="Companies held"
                value={String(investor.holdingsCount)}
                sub={
                  investor.unpricedCount
                    ? `${investor.unpricedCount} without a live quote`
                    : undefined
                }
              />
              <Stat
                label="Vs previous quarter"
                value={`${counts.new} new · ${counts.increased} up`}
                sub={`${counts.decreased} down · ${counts.exited} exited / <1%`}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((value) => (
              <button
                key={value.id}
                onClick={() => setSection(value.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  section === value.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {value.label}
                {value.id === "holdings" && ` (${investor.holdingsCount})`}
                {value.id === "deals" && data ? ` (${data.deals.length})` : ""}
              </button>
            ))}
          </div>

          {section === "holdings" && (
            <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
              <div className="flex flex-col gap-3 border-b border-border bg-muted/80 p-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter company or sector..."
                    className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none md:text-sm"
                  />
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showExited}
                    onChange={(event) => setShowExited(event.target.checked)}
                    className="accent-primary"
                  />
                  Show exited / below 1% since last quarter
                </label>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full border-collapse text-left text-xs md:text-sm">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-md">
                    <tr>
                      {COLUMNS.map((column) => (
                        <SortableTh
                          key={column.key}
                          label={column.label}
                          sortKey={column.key}
                          sort={sort}
                          onSort={(key) =>
                            setSort((current) => nextSort(current, key, column.align === "left" && key !== "change"))
                          }
                          align={column.align}
                          className="select-none whitespace-nowrap px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={COLUMNS.length}
                          className="px-4 py-12 text-center text-xs text-muted-foreground"
                        >
                          No holdings match this filter.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={`${row.symbol}-${row.category}`}
                          className={`finder-row border-b border-border/80 transition-colors odd:bg-muted/50 even:bg-card hover:bg-primary/10 ${
                            row.change === "exited" ? "opacity-60" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-3.5 py-2.5">
                            <Link
                              href={`/stock/${encodeURIComponent(row.symbol)}`}
                              className="font-bold text-foreground hover:text-primary hover:underline"
                            >
                              {row.companyName}
                            </Link>
                            <div className="text-[10px] font-medium text-muted-foreground">
                              {row.symbol}
                              {investor.categories.length > 1
                                ? ` · ${SUPER_INVESTOR_CATEGORY_LABELS[row.category]}`
                                : ""}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-xs text-muted-foreground">
                            {row.sector}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font text-foreground">
                            {row.change === "exited" ? (
                              <span className="text-muted-foreground">
                                was {formatShares(row.previousShares)}
                              </span>
                            ) : (
                              formatShares(row.shares)
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold num-font text-foreground">
                            {row.change === "exited"
                              ? "—"
                              : formatPercent(row.percent)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                            {row.change ? (
                              <span
                                title={
                                  row.previousPercent !== null
                                    ? `${formatPercent(row.previousPercent)} on ${formatDate(row.previousAsOfDate)}`
                                    : row.previousAsOfDate
                                      ? `Not in the ${formatDate(row.previousAsOfDate)} filing`
                                      : undefined
                                }
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${changeBadgeClass(row.change)}`}
                              >
                                {CHANGE_LABELS[row.change]}
                                {(row.change === "increased" ||
                                  row.change === "decreased") &&
                                  row.previousPercent !== null && (
                                    <span className="font-mono num-font">
                                      {formatSignedPercent(
                                        row.percent - row.previousPercent,
                                      )}
                                    </span>
                                  )}
                              </span>
                            ) : (
                              <span
                                className="text-[11px] text-muted-foreground"
                                title="No earlier filing to compare"
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font text-foreground">
                            {formatPrice(row.lastPrice)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold num-font ${toneClass(row.dayChangePct)}`}
                          >
                            {formatSignedPercent(row.dayChangePct)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold num-font text-foreground">
                            {formatCrores(row.value)}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font ${toneClass(row.dayChangeValue)}`}
                          >
                            {formatSignedCrores(row.dayChangeValue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot className="border-t-2 border-border bg-muted/80">
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3.5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                        >
                          Total portfolio ({investor.holdingsCount} companies)
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-right font-mono font-extrabold num-font text-foreground">
                          {formatCrores(investor.totalValue)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-3.5 py-3 text-right font-mono font-bold num-font ${toneClass(investor.dayChange)}`}
                        >
                          {formatSignedCrores(investor.dayChange)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {section === "history" && (
            <StakeHistoryPanel investorId={investor.id} />
          )}

          {section === "deals" && (
            <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
              <p className="border-b border-border bg-muted/80 px-4 py-3 text-[11px] text-muted-foreground">
                NSE bulk and block deals where the client name matches{" "}
                {investor.name}.
              </p>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full border-collapse text-left text-xs md:text-sm">
                  <thead className="border-b border-border bg-muted/90">
                    <tr>
                      {DEAL_COLUMNS.map((column) => (
                        <SortableTh
                          key={column.key}
                          label={column.label}
                          sortKey={column.key}
                          sort={dealSort}
                          onSort={(key) =>
                            setDealSort((current) => nextSort(current, key, key === "stock" || key === "deal"))
                          }
                          align={column.align}
                          className="whitespace-nowrap px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {deals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-xs text-muted-foreground"
                        >
                          No bulk or block deals on record under this name.
                        </td>
                      </tr>
                    ) : (
                      deals.map((deal) => (
                        <tr
                          key={`${deal.dealType}-${deal.dealDate}-${deal.symbol}-${deal.clientName}-${deal.transactionType}-${deal.quantity}-${deal.price}`}
                          className="odd:bg-muted/50 even:bg-card"
                        >
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-xs text-muted-foreground num-font">
                            {formatDate(deal.dealDate)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5">
                            <Link
                              href={`/stock/${encodeURIComponent(deal.symbol)}`}
                              className="font-semibold text-foreground hover:text-primary hover:underline"
                            >
                              {deal.companyName}
                            </Link>
                            {deal.clientName.toUpperCase() !==
                              investor.name.toUpperCase() && (
                              <div className="text-[10px] text-muted-foreground">
                                as {deal.clientName}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                                deal.transactionType === "BUY"
                                  ? "border-success/30 bg-success/10 text-success"
                                  : "border-error/30 bg-error/10 text-error"
                              }`}
                            >
                              {deal.dealType.toUpperCase()}{" "}
                              {deal.transactionType}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font">
                            {formatShares(deal.quantity)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font">
                            {formatPrice(deal.price)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold num-font">
                            {formatCrores(deal.quantity * deal.price)}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font">
                            {formatPrice(deal.lastPrice)}
                            <div
                              className={`text-[10px] font-bold ${toneClass(deal.dayChangePct)}`}
                            >
                              {formatSignedPercent(deal.dayChangePct)}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error !== null && (
            <p className="text-[11px] text-warning">
              Live refresh failed — showing the last update.{" "}
              {getSuperInvestorErrorMessage(error)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly tone?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-base font-extrabold num-font md:text-lg ${tone === undefined ? "text-foreground" : toneClass(tone)}`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`mt-0.5 text-[11px] font-semibold ${tone === undefined ? "text-muted-foreground" : toneClass(tone)}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
