"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  UserCheck,
} from "lucide-react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import { LiveStatus } from "@/components/super-investors/LiveStatus";
import { SortableTh } from "@/components/super-investors/SortableTh";
import { SuperInvestorDetail } from "@/components/super-investors/SuperInvestorDetail";
import {
  avatarColor,
  CHANGE_LABELS,
  changeBadgeClass,
  formatCrores,
  formatDate,
  formatDateTime,
  formatPercent,
  formatPrice,
  formatShares,
  formatSignedPercent,
  initials,
  toneClass,
} from "@/components/super-investors/format";
import { usePolledResource } from "@/lib/hooks/usePolledResource";
import {
  fetchSuperInvestorChanges,
  fetchSuperInvestorCommonStocks,
  fetchSuperInvestorDeals,
  fetchSuperInvestors,
  getSuperInvestorErrorMessage,
  SUPER_INVESTORS_POLL_MS,
  type SuperInvestorMeta,
} from "@/lib/super-investors/client";
import {
  SUPER_INVESTOR_CATEGORIES,
  SUPER_INVESTOR_CATEGORY_DESCRIPTIONS,
  SUPER_INVESTOR_CATEGORY_LABELS,
  type SuperInvestorCategory,
} from "@/lib/super-investors/classify";
import {
  dealSortValue,
  nextSort,
  sortRows,
  type ChangeSortKey,
  type CommonSortKey,
  type DealSortKey,
  type InvestorSortKey,
  type SortState,
} from "@/lib/super-investors/sorting";

const SORT_LABELS: Readonly<Record<string, string>> = {
  name: "investor name",
  holdings: "number of holdings",
  value: "live holding value",
  dayChange: "day change %",
  moves: "net QoQ moves",
  topPerformer: "top performer's 3M return",
  filed: "filing date",
  investor: "investor",
  stock: "company",
  change: "type of change",
  stake: "stake change",
  price: "price",
  holders: "number of holders",
  combined: "combined stake",
  heldBy: "largest holder",
  date: "deal date",
  deal: "deal type",
  quantity: "quantity",
  dealPrice: "deal price",
  livePrice: "live price",
};

function sortCaption(sort: SortState<string>): string {
  const label = SORT_LABELS[sort.key] ?? sort.key;
  return `sorted by ${label}, ${sort.dir === "asc" ? "ascending" : "descending"}`;
}

/** Text columns start A→Z; everything else starts largest / newest first. */
const TEXT_SORT_KEYS = new Set(["name", "investor", "stock", "heldBy", "deal", "change"]);

const TABS = [
  "Investors",
  "Key Changes",
  "Recent Deals",
  "Common Stocks",
] as const;
type Tab = (typeof TABS)[number];

const TAB_PARAM: Record<Tab, string> = {
  Investors: "investors",
  "Key Changes": "changes",
  "Recent Deals": "deals",
  "Common Stocks": "common",
};

const TH =
  "px-3.5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none whitespace-nowrap";
const ROW =
  "finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group";

function readTab(value: string | null): Tab {
  return TABS.find((tab) => TAB_PARAM[tab] === value) ?? "Investors";
}

function readCategory(value: string | null): SuperInvestorCategory {
  return (SUPER_INVESTOR_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as SuperInvestorCategory)
    : "public";
}

type MetaListener = (
  meta: SuperInvestorMeta,
  refreshing: boolean,
  updatedAt: number | null,
) => void;

/** Lifts the freshest response metadata up to the page header without updating the parent mid-render. */
function useReportMeta(
  meta: SuperInvestorMeta | null,
  refreshing: boolean,
  updatedAt: number | null,
  onMeta: MetaListener,
): void {
  useEffect(() => {
    if (meta) onMeta(meta, refreshing, updatedAt);
  }, [meta, refreshing, updatedAt, onMeta]);
}

function StatusRow({
  colSpan,
  children,
  tone = "muted",
}: {
  colSpan: number;
  children: React.ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`px-4 py-16 text-center text-xs ${tone === "error" ? "text-error" : "text-muted-foreground"}`}
      >
        {children}
      </td>
    </tr>
  );
}

function InvestorAvatar({ id, name }: { id: string; name: string }) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-xs"
      style={{ backgroundColor: avatarColor(id) }}
    >
      {initials(name)}
    </div>
  );
}

function CategoryChips({
  value,
  onChange,
}: {
  value: SuperInvestorCategory;
  onChange: (category: SuperInvestorCategory) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SUPER_INVESTOR_CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onChange(category)}
          title={SUPER_INVESTOR_CATEGORY_DESCRIPTIONS[category]}
          className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
            value === category
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          {SUPER_INVESTOR_CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}

function InvestorsTable({
  category,
  onCategory,
  onOpen,
  onMeta,
}: {
  category: SuperInvestorCategory;
  onCategory: (category: SuperInvestorCategory) => void;
  onOpen: (id: string) => void;
  onMeta: MetaListener;
}) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [sort, setSort] = useState<SortState<InvestorSortKey>>({ key: "value", dir: "desc" });
  const onSort = (key: InvestorSortKey): void =>
    setSort((current) => nextSort(current, key, TEXT_SORT_KEYS.has(key)));
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      fetchSuperInvestors(
        { category, search: deferredSearch, limit: 150, sort },
        signal,
      ),
    [category, deferredSearch, sort],
  );
  const { data, error, loading, refreshing, updatedAt } = usePolledResource(
    `${category}|${deferredSearch}|${sort.key}|${sort.dir}`,
    fetcher,
    SUPER_INVESTORS_POLL_MS,
  );
  useReportMeta(data?.meta ?? null, refreshing, updatedAt, onMeta);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/80 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search any investor..."
            className="w-full rounded-xl border border-border bg-card py-1.5 pl-8 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none md:text-sm"
          />
        </div>
        <CategoryChips value={category} onChange={onCategory} />
      </div>
      <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
        {SUPER_INVESTOR_CATEGORY_DESCRIPTIONS[category]}.{" "}
        {data
          ? `Showing ${data.investors.length} of ${data.total.toLocaleString("en-IN")}${
              deferredSearch
                ? " matches"
                : category === "public" ||
                    category === "promoter" ||
                    category === "corporate"
                  ? " with 2+ holdings"
                  : ""
            }, ${sortCaption(sort)}.`
          : null}
      </p>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-xs md:text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-md">
            <tr>
              <SortableTh className={TH} label={`${SUPER_INVESTOR_CATEGORY_LABELS[category]} Investor`} sortKey="name" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Holdings" sortKey="holdings" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Holding Value (Live)" sortKey="value" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Day Change" sortKey="dayChange" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="QoQ Moves" sortKey="moves" sort={sort} onSort={onSort} align="center" />
              <SortableTh className={TH} label="Top Performer (3M)" sortKey="topPerformer" sort={sort} onSort={onSort} align="right" />
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <StatusRow colSpan={7}>Loading investors…</StatusRow>
            ) : !data ? (
              <StatusRow colSpan={7} tone="error">
                {getSuperInvestorErrorMessage(error)}
              </StatusRow>
            ) : data.investors.length === 0 ? (
              <StatusRow colSpan={7}>
                {deferredSearch
                  ? "No investors found matching your search."
                  : "No filings parsed yet — the super-investor sync is still indexing NSE shareholding filings."}
              </StatusRow>
            ) : (
              data.investors.map((investor) => (
                <tr
                  key={investor.id}
                  onClick={() => onOpen(investor.id)}
                  className={`${ROW} cursor-pointer`}
                >
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <div className="flex items-center gap-3">
                      <InvestorAvatar id={investor.id} name={investor.name} />
                      <div className="font-bold text-foreground transition-colors group-hover:text-primary">
                        {investor.name}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-muted-foreground num-font">
                    {investor.holdingsCount}{" "}
                    {investor.holdingsCount === 1 ? "stock" : "stocks"}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-foreground num-font">
                    {formatCrores(investor.value)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold num-font ${toneClass(investor.dayChangePct)}`}
                  >
                    {formatSignedPercent(investor.dayChangePct)}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-center text-[11px] font-semibold">
                    <span className="text-success">+{investor.newCount}</span>
                    <span className="text-muted-foreground"> new · </span>
                    <span className="text-primary">
                      ↑{investor.increasedCount}
                    </span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-warning">
                      ↓{investor.decreasedCount}
                    </span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-error">×{investor.exitedCount}</span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                    {investor.topPerformer ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {investor.topPerformer.symbol}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-xs font-bold num-font ${
                            investor.topPerformer.change3mPct >= 0
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-error/30 bg-error/10 text-error"
                          }`}
                        >
                          {formatSignedPercent(
                            investor.topPerformer.change3mPct,
                            1,
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeyChangesTable({
  category,
  onCategory,
  onOpen,
  onMeta,
}: {
  category: SuperInvestorCategory;
  onCategory: (category: SuperInvestorCategory) => void;
  onOpen: (id: string) => void;
  onMeta: MetaListener;
}) {
  const [sort, setSort] = useState<SortState<ChangeSortKey>>({ key: "filed", dir: "desc" });
  const onSort = (key: ChangeSortKey): void =>
    setSort((current) => nextSort(current, key, TEXT_SORT_KEYS.has(key)));
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchSuperInvestorChanges(category, signal, sort),
    [category, sort],
  );
  const { data, error, loading, refreshing, updatedAt } = usePolledResource(
    `changes|${category}|${sort.key}|${sort.dir}`,
    fetcher,
    SUPER_INVESTORS_POLL_MS,
  );
  useReportMeta(data?.meta ?? null, refreshing, updatedAt, onMeta);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/80 p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] text-muted-foreground">
          Stake changes between each company&apos;s latest two shareholding
          filings, {sortCaption(sort)}.
        </p>
        <CategoryChips value={category} onChange={onCategory} />
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-xs md:text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-md">
            <tr>
              <SortableTh className={TH} label="Filed" sortKey="filed" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Investor" sortKey="investor" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Stock" sortKey="stock" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Change" sortKey="change" sort={sort} onSort={onSort} align="center" />
              <SortableTh className={TH} label="Stake (prev → now)" sortKey="stake" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Holding Value" sortKey="value" sort={sort} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <StatusRow colSpan={7}>Loading changes…</StatusRow>
            ) : !data ? (
              <StatusRow colSpan={7} tone="error">
                {getSuperInvestorErrorMessage(error)}
              </StatusRow>
            ) : data.changes.length === 0 ? (
              <StatusRow colSpan={7}>
                No quarter-on-quarter changes yet — the previous quarter&apos;s
                filings may still be loading.
              </StatusRow>
            ) : (
              data.changes.map((change) => (
                <tr
                  key={`${change.investorId}-${change.symbol}`}
                  className={ROW}
                >
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-xs text-muted-foreground num-font">
                    {formatDate(change.filedAt)}
                    <div className="text-[10px]">
                      as on {formatDate(change.asOfDate)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <button
                      onClick={() => onOpen(change.investorId)}
                      className="font-bold text-foreground hover:text-primary hover:underline"
                    >
                      {change.investorName}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <Link
                      href={`/stock/${encodeURIComponent(change.symbol)}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {change.companyName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${changeBadgeClass(change.change)}`}
                    >
                      {CHANGE_LABELS[change.change]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-foreground num-font">
                    {formatPercent(change.previousPercent)} →{" "}
                    {change.change === "exited"
                      ? "<1%"
                      : formatPercent(change.percent)}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font">
                    {formatPrice(change.lastPrice)}
                    <div
                      className={`text-[10px] font-bold ${toneClass(change.dayChangePct)}`}
                    >
                      {formatSignedPercent(change.dayChangePct)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-foreground num-font">
                    {change.change === "exited"
                      ? "—"
                      : formatCrores(change.value)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentDealsTable({
  onOpen,
  onMeta,
}: {
  onOpen: (id: string) => void;
  onMeta: MetaListener;
}) {
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchSuperInvestorDeals(signal),
    [],
  );
  const { data, error, loading, refreshing, updatedAt } = usePolledResource(
    "deals",
    fetcher,
    SUPER_INVESTORS_POLL_MS,
  );
  useReportMeta(data?.meta ?? null, refreshing, updatedAt, onMeta);
  const [sort, setSort] = useState<SortState<DealSortKey>>({ key: "date", dir: "desc" });
  const onSort = (key: DealSortKey): void =>
    setSort((current) => nextSort(current, key, TEXT_SORT_KEYS.has(key)));
  const deals = useMemo(
    () => (data ? sortRows(data.deals, (deal) => dealSortValue(deal, sort.key), sort.dir) : []),
    [data, sort],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
      <p className="border-b border-border bg-muted/80 px-4 py-3 text-[11px] text-muted-foreground">
        NSE bulk and block deals whose client matches an investor named in a
        shareholding filing.
        {data?.trackedSince
          ? ` Deal history collected since ${formatDate(data.trackedSince)}.`
          : ""}
      </p>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-xs md:text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-md">
            <tr>
              <SortableTh className={TH} label="Date" sortKey="date" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Investor" sortKey="investor" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Stock" sortKey="stock" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Deal" sortKey="deal" sort={sort} onSort={onSort} align="center" />
              <SortableTh className={TH} label="Quantity" sortKey="quantity" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Deal Price" sortKey="dealPrice" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Live Price" sortKey="livePrice" sort={sort} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <StatusRow colSpan={7}>Loading deals…</StatusRow>
            ) : !data ? (
              <StatusRow colSpan={7} tone="error">
                {getSuperInvestorErrorMessage(error)}
              </StatusRow>
            ) : data.deals.length === 0 ? (
              <StatusRow colSpan={7}>
                No bulk or block deals by tracked investors in the collected
                history yet.
              </StatusRow>
            ) : (
              deals.map((deal) => (
                <tr
                  key={`${deal.dealType}-${deal.dealDate}-${deal.symbol}-${deal.clientName}-${deal.transactionType}-${deal.quantity}`}
                  className={ROW}
                >
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-xs text-muted-foreground num-font">
                    {formatDate(deal.dealDate)}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <button
                      onClick={() => onOpen(deal.investorId)}
                      className="font-bold text-foreground hover:text-primary hover:underline"
                    >
                      {deal.investorName}
                    </button>
                    {deal.category && (
                      <div className="text-[10px] text-muted-foreground">
                        {SUPER_INVESTOR_CATEGORY_LABELS[deal.category]}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <Link
                      href={`/stock/${encodeURIComponent(deal.symbol)}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {deal.companyName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${
                        deal.transactionType === "BUY"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-error/30 bg-error/10 text-error"
                      }`}
                    >
                      {deal.dealType.toUpperCase()} {deal.transactionType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-muted-foreground num-font">
                    {formatShares(deal.quantity)}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold text-foreground num-font">
                    {formatPrice(deal.price)}
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
  );
}

function CommonStocksTable({
  category,
  onCategory,
  onOpen,
  onMeta,
}: {
  category: SuperInvestorCategory;
  onCategory: (category: SuperInvestorCategory) => void;
  onOpen: (id: string) => void;
  onMeta: MetaListener;
}) {
  const [sort, setSort] = useState<SortState<CommonSortKey>>({ key: "holders", dir: "desc" });
  const onSort = (key: CommonSortKey): void =>
    setSort((current) => nextSort(current, key, TEXT_SORT_KEYS.has(key)));
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchSuperInvestorCommonStocks(category, signal, sort),
    [category, sort],
  );
  const { data, error, loading, refreshing, updatedAt } = usePolledResource(
    `common|${category}|${sort.key}|${sort.dir}`,
    fetcher,
    SUPER_INVESTORS_POLL_MS,
  );
  useReportMeta(data?.meta ?? null, refreshing, updatedAt, onMeta);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/80 p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-[11px] text-muted-foreground">
          Stocks held by two or more investors in this category, {sortCaption(sort)}.
        </p>
        <CategoryChips value={category} onChange={onCategory} />
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-left text-xs md:text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-md">
            <tr>
              <SortableTh className={TH} label="Stock" sortKey="stock" sort={sort} onSort={onSort} />
              <SortableTh className={TH} label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Holders" sortKey="holders" sort={sort} onSort={onSort} align="center" />
              <SortableTh className={TH} label="Combined Stake" sortKey="combined" sort={sort} onSort={onSort} align="right" />
              <SortableTh className={TH} label="Held By" sortKey="heldBy" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <StatusRow colSpan={5}>Loading common stocks…</StatusRow>
            ) : !data ? (
              <StatusRow colSpan={5} tone="error">
                {getSuperInvestorErrorMessage(error)}
              </StatusRow>
            ) : data.stocks.length === 0 ? (
              <StatusRow colSpan={5}>
                No stock is held by two or more investors in this category yet.
              </StatusRow>
            ) : (
              data.stocks.map((stock) => (
                <tr key={stock.symbol} className={ROW}>
                  <td className="whitespace-nowrap px-3.5 py-2.5">
                    <Link
                      href={`/stock/${encodeURIComponent(stock.symbol)}`}
                      className="font-bold text-foreground hover:text-primary hover:underline"
                    >
                      {stock.companyName}
                    </Link>
                    <div className="text-[10px] text-muted-foreground">
                      {stock.symbol} · {stock.sector}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono num-font">
                    {formatPrice(stock.lastPrice)}
                    <div
                      className={`text-[10px] font-bold ${toneClass(stock.dayChangePct)}`}
                    >
                      {formatSignedPercent(stock.dayChangePct)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-center">
                    <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {stock.holders.length} Investors
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right font-mono font-bold num-font">
                    {formatPercent(stock.combinedPercent)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {stock.holders.map((holder) => (
                        <button
                          key={holder.id}
                          onClick={() => onOpen(holder.id)}
                          className="rounded-lg border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
                          title={`${formatPercent(holder.percent)} stake`}
                        >
                          {holder.name}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const INFO_SECTIONS = [
  {
    id: "about",
    title: "Where this data comes from",
    content:
      "Every listed company files its shareholding pattern with the exchanges each quarter (SEBI LODR Regulation 31). Those filings name every promoter-group entity and every public shareholder above 1%. This page parses NSE's XBRL copies of those filings for main-board and SME companies, back to the Jun-2021 quarter, plus BSE's own filings for companies that file only with BSE, read from BSE's public shareholding feed. It groups the names into investors (mutual-fund schemes roll up to their fund house) and prices every holding with the live quote.",
  },
  {
    id: "freshness",
    title: "How fresh is it?",
    content:
      "Share counts are as of each company's latest filing (filed within 21 days of quarter end, so a quarter fills in gradually). New filings are picked up within about 15 minutes of NSE publishing them. Prices, values and day change come from the live quote feed and refresh every 15 seconds while the page is open.",
  },
  {
    id: "how-to-use",
    title: "How to use this view",
    content:
      "Pick a category and click any investor to see every company they hold, their stake, the change from the previous quarter, the live holding value and today's move. Stake history shows every quarter since 2021, including companies they have since left, and Bulk / block deals lists their exchange-reported trades. Key Changes lists new buys, increases, cuts and exits across the category.",
  },
  {
    id: "disclaimer",
    title: "Data caveats",
    content:
      "Companies that file only with BSE (including BSE stocks traded on NSE under 'permitted to trade') are covered from November 2026 onward, as BSE publishes their filings in its public feed. Their earlier quarters, and a company's years before its NSE listing, are not available: BSE's historical data API refuses automated access. Holders below 1% are not disclosed, so an exit can also mean a stake fell under 1%. Names are matched exactly as filed — an investor who files under two spellings shows twice. Not financial advice.",
  },
];

function InformationSidebar({ meta }: { meta: SuperInvestorMeta | null }) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["about", "freshness"]),
  );
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
        Portfolio Insights
      </h2>
      {meta && (
        <div className="space-y-1.5 rounded-2xl border border-border/90 bg-card p-4 text-xs shadow-xs">
          <InfoLine
            label="Latest quarter"
            value={formatDate(meta.latestAsOfDate)}
          />
          <InfoLine
            label="Newest filing"
            value={formatDateTime(meta.latestFiledAt)}
          />
          <InfoLine
            label="Companies parsed"
            value={meta.companyCount.toLocaleString("en-IN")}
          />
          <a
            href={meta.source.url}
            target="_blank"
            rel="noreferrer"
            className="block pt-1 text-[11px] font-semibold text-primary hover:underline"
          >
            {meta.source.name} ↗
          </a>
        </div>
      )}
      {INFO_SECTIONS.map((section) => {
        const isOpen = expanded.has(section.id);
        return (
          <div
            key={section.id}
            className="overflow-hidden rounded-2xl border border-border/90 bg-card shadow-xs"
          >
            <button
              onClick={() => toggle(section.id)}
              className="flex w-full items-center justify-between bg-muted/50 px-4 py-3 text-left text-xs font-bold text-foreground transition-colors hover:bg-muted"
            >
              {section.title}
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            {isOpen && (
              <p className="border-t border-border p-4 text-xs leading-relaxed text-muted-foreground">
                {section.content}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground num-font">
        {value}
      </span>
    </div>
  );
}

export default function SuperInvestorsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = readTab(searchParams.get("tab"));
  const category = readCategory(searchParams.get("category"));
  const investorId = searchParams.get("investor");
  const [live, setLive] = useState<{
    meta: SuperInvestorMeta;
    refreshing: boolean;
    updatedAt: number | null;
  } | null>(null);

  const navigate = useCallback(
    (changes: Record<string, string | null>, mode: "push" | "replace") => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openInvestor = useCallback(
    (id: string) => {
      navigate({ investor: id }, "push");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [navigate],
  );
  const setCategory = useCallback(
    (next: SuperInvestorCategory) => navigate({ category: next }, "replace"),
    [navigate],
  );
  const onMeta = useCallback(
    (
      meta: SuperInvestorMeta,
      refreshing: boolean,
      updatedAt: number | null,
    ) => {
      setLive((current) =>
        current &&
        current.updatedAt === updatedAt &&
        current.refreshing === refreshing &&
        current.meta.quotesSyncedAt === meta.quotesSyncedAt
          ? current
          : { meta, refreshing, updatedAt },
      );
    },
    [],
  );

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <UnofficialSourceBadge
          label="Holdings parsed from NSE's public shareholding-pattern filings (unofficial access, not a supported API); prices from the live quote feed"
          lastSyncAt={live?.meta.snapshotBuiltAt ?? null}
        />

        <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-6 shadow-xs md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                Super Investor Portfolios
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
                Real holdings of promoters, star investors, AIFs, DIIs and FIIs
                from exchange filings, valued live
                {live?.meta.latestAsOfDate
                  ? ` · quarter ending ${formatDate(live.meta.latestAsOfDate)}`
                  : ""}
              </p>
            </div>
          </div>
          {live && !investorId && (
            <LiveStatus
              refreshing={live.refreshing}
              updatedAt={live.updatedAt}
              quotesSyncedAt={live.meta.quotesSyncedAt}
            />
          )}
        </div>

        {!investorId && (
          <div className="mb-6 flex space-x-2 overflow-x-auto bg-transparent p-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => navigate({ tab: TAB_PARAM[tab] }, "replace")}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition-all md:text-sm ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-primary/20"
                    : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="min-w-0 lg:col-span-3">
            {investorId ? (
              <SuperInvestorDetail
                investorId={investorId}
                onBack={() => navigate({ investor: null }, "push")}
              />
            ) : (
              <>
                {activeTab === "Investors" && (
                  <InvestorsTable
                    category={category}
                    onCategory={setCategory}
                    onOpen={openInvestor}
                    onMeta={onMeta}
                  />
                )}
                {activeTab === "Key Changes" && (
                  <KeyChangesTable
                    category={category}
                    onCategory={setCategory}
                    onOpen={openInvestor}
                    onMeta={onMeta}
                  />
                )}
                {activeTab === "Recent Deals" && (
                  <RecentDealsTable onOpen={openInvestor} onMeta={onMeta} />
                )}
                {activeTab === "Common Stocks" && (
                  <CommonStocksTable
                    category={category}
                    onCategory={setCategory}
                    onOpen={openInvestor}
                    onMeta={onMeta}
                  />
                )}
              </>
            )}
          </div>
          <div className="lg:col-span-1">
            <InformationSidebar meta={live?.meta ?? null} />
          </div>
        </div>
      </div>
    </div>
  );
}
