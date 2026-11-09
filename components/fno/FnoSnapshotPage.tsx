"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw, Search, X } from "lucide-react";
import { SortableTh } from "@/components/super-investors/SortableTh";
import { nextSort, sortRows, type SortState } from "@/lib/super-investors/sorting";
import type { ActiveOption, Buildup, ExpirySeries, FutureRow, OptionChainRow, OptionLeg } from "@/lib/fno-snapshot/parse";
import type { FnoSnapshotResponse, OptionChainResponse } from "@/lib/fno-snapshot/service";
import { FNO_FAQ, FNO_GLOSSARY } from "@/lib/fno-snapshot/glossary";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
const SNAPSHOT_REFRESH_MS = 30_000;
const CHAIN_REFRESH_MS = 30_000;
const GLOBAL_REFRESH_MS = 60_000;
const CHAIN_STRIKES_EACH_SIDE = 3;
const DEFAULT_INDEX = "NIFTY";

const TH = "whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const TD = "whitespace-nowrap px-3 py-1.5 text-xs tabular-nums";

const SERIES: readonly { id: ExpirySeries; label: string }[] = [
  { id: "near", label: "Near" },
  { id: "next", label: "Next" },
  { id: "far", label: "Far" },
];

const BUILDUP_LABEL: Readonly<Record<Buildup, string>> = {
  "long-buildup": "Long Build-up",
  "short-buildup": "Short Build-up",
  "short-covering": "Short Covering",
  "long-unwinding": "Long Unwinding",
};
const BUILDUP_STYLE: Readonly<Record<Buildup, string>> = {
  "long-buildup": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "short-covering": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "short-buildup": "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "long-unwinding": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

// ── formatting ─────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function int(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-IN");
}

function tone(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0 || !Number.isFinite(value)) return "text-foreground";
  return value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function signed(value: number | null | undefined, decimals = 2, suffix = ""): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${fmt(value, decimals)}${suffix}`;
}

function Pct({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  return <span className={`font-semibold ${tone(value)} ${className}`}>{signed(value, 2, "%")}</span>;
}

/** "2026-11-23" → "23-Nov-26", the way exchanges label contracts. */
function expiryLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${day}-${month}-${String(date.getUTCFullYear()).slice(-2)}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function istToday(): string {
  return new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
}

// ── building blocks ────────────────────────────────────────────────────────

function Card({
  title,
  actions,
  children,
  footer,
  className = "",
}: {
  readonly title: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-foreground md:text-base">{title}</h2>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? <footer className="border-t border-border px-4 py-2 text-right text-xs">{footer}</footer> : null}
    </section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  readonly options: readonly { id: T; label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly size?: "sm" | "xs";
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={`rounded-md font-semibold transition-colors ${size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} ${
            value === option.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
  label,
  className = "",
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: React.ReactNode;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`min-w-0 max-w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold text-foreground focus:border-ring focus:outline-none ${className}`}
    >
      {children}
    </select>
  );
}

function MoreButton({ expanded, onClick, total, shown }: { expanded: boolean; onClick: () => void; total: number; shown: number }) {
  if (total <= shown && !expanded) return null;
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
      {expanded ? "Show less" : `more (${total})`}
      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-xs text-muted-foreground">{children}</p>;
}

function StockLink({ symbol, isIndex }: { symbol: string; isIndex: boolean }) {
  if (isIndex) return <span className="font-semibold text-foreground">{symbol}</span>;
  return (
    <Link href={`/stock/${encodeURIComponent(symbol)}`} className="font-semibold text-foreground hover:text-primary hover:underline">
      {symbol}
    </Link>
  );
}

// ── data hooks ─────────────────────────────────────────────────────────────

function useSnapshot() {
  const [data, setData] = useState<FnoSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/market-data/fno/snapshot", { cache: "no-store", signal: controller.signal });
        const body = (unwrapApiEnvelope(await response.json()) as FnoSnapshotResponse & { message?: string });
        if (!response.ok || !Array.isArray(body.futures)) throw new Error(body.message ?? "F&O data is unavailable right now.");
        setData(body);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "F&O data is unavailable right now.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), SNAPSHOT_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [version]);

  return { data, error, loading, refresh: () => setVersion((value) => value + 1) };
}

function useOptionChain(symbol: string, expiry: string | null) {
  const [chain, setChain] = useState<OptionChainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    const load = async (first: boolean) => {
      if (first) setLoading(true);
      try {
        const params = new URLSearchParams({ symbol });
        if (expiry) params.set("expiry", expiry);
        const response = await fetch(`/api/market-data/fno/snapshot/chain?${params}`, { cache: "no-store", signal: controller.signal });
        const body = (unwrapApiEnvelope(await response.json()) as OptionChainResponse & { message?: string });
        if (!response.ok || !Array.isArray(body.rows)) throw new Error(body.message ?? "Option chain unavailable.");
        setChain(body);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Option chain unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load(true);
    const timer = window.setInterval(() => void load(false), CHAIN_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [symbol, expiry]);

  return { chain: chain && chain.symbol === symbol ? chain : null, error, loading };
}

interface Underlying {
  readonly symbol: string;
  readonly name: string;
  readonly isIndex: boolean;
  readonly expiries: readonly string[];
}

function underlyingsOf(futures: readonly FutureRow[]): Underlying[] {
  const map = new Map<string, { symbol: string; name: string; isIndex: boolean; expiries: Set<string> }>();
  for (const row of futures) {
    const entry = map.get(row.symbol) ?? { symbol: row.symbol, name: row.name, isIndex: row.isIndex, expiries: new Set<string>() };
    entry.expiries.add(row.expiry);
    map.set(row.symbol, entry);
  }
  return [...map.values()]
    .map((entry) => ({ ...entry, expiries: [...entry.expiries].sort() }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

// ── search (futures / options) ─────────────────────────────────────────────

type Market = "futures" | "options";
type Kind = "stocks" | "index";

interface OptionSearch {
  readonly symbol: string;
  readonly expiry: string;
  readonly type: "CE" | "PE";
  readonly strike: number;
}

function SearchCard({
  underlyings,
  onFuture,
  onOption,
}: {
  readonly underlyings: readonly Underlying[];
  readonly onFuture: (symbol: string, expiry: string) => void;
  readonly onOption: (search: OptionSearch) => void;
}) {
  const [market, setMarket] = useState<Market>("futures");
  const [kind, setKind] = useState<Kind>("stocks");
  const [symbol, setSymbol] = useState("");
  const [expiry, setExpiry] = useState("");
  const [type, setType] = useState<"CE" | "PE">("CE");
  const [strike, setStrike] = useState("");
  const list = useMemo(() => underlyings.filter((item) => item.isIndex === (kind === "index")), [underlyings, kind]);
  const { chain, loading } = useOptionChain(market === "options" ? symbol : "", market === "options" && expiry ? expiry : null);

  const expiries = market === "futures" ? (list.find((item) => item.symbol === symbol)?.expiries ?? []) : (chain?.expiries ?? []);
  const strikes = chain?.rows.map((row) => row.strike) ?? [];

  const reset = () => {
    setSymbol("");
    setExpiry("");
    setStrike("");
  };

  const ready = symbol && (market === "futures" ? expiry : (expiry || chain?.expiry) && strike);
  const submit = () => {
    if (!ready) return;
    if (market === "futures") onFuture(symbol, expiry);
    else onOption({ symbol, expiry: expiry || chain!.expiry, type, strike: Number(strike) });
  };

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { id: "futures", label: "Futures" },
            { id: "options", label: "Options" },
          ]}
          value={market}
          onChange={(value) => {
            setMarket(value);
            reset();
          }}
        />
        <Segmented
          options={[
            { id: "stocks", label: "Stocks" },
            { id: "index", label: "Index" },
          ]}
          value={kind}
          onChange={(value) => {
            setKind(value);
            reset();
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {kind === "index" ? "Index" : "Stock"}
          <Select label={kind === "index" ? "Index" : "Stock"} value={symbol} onChange={(value) => { setSymbol(value); setExpiry(""); setStrike(""); }} className="lg:w-52">
            <option value="">Select</option>
            {list.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.isIndex ? item.symbol : `${item.symbol} — ${item.name}`}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Expiry Date
          <Select label="Expiry date" value={expiry || (market === "options" ? (chain?.expiry ?? "") : "")} onChange={(value) => { setExpiry(value); setStrike(""); }} className="lg:w-36">
            <option value="">{market === "options" && loading ? "Loading…" : "Select"}</option>
            {expiries.map((date) => (
              <option key={date} value={date}>
                {expiryLabel(date)}
              </option>
            ))}
          </Select>
        </label>
        {market === "options" ? (
          <>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Option Type
              <Select label="Option type" value={type} onChange={(value) => setType(value as "CE" | "PE")} className="lg:w-28">
                <option value="CE">Call (CE)</option>
                <option value="PE">Put (PE)</option>
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Strike Price
              <Select label="Strike price" value={strike} onChange={setStrike} className="lg:w-32">
                <option value="">Select</option>
                {strikes.map((value) => (
                  <option key={value} value={value}>
                    {fmt(value, value % 1 === 0 ? 0 : 2)}
                    {chain?.atmStrike === value ? " (ATM)" : ""}
                  </option>
                ))}
              </Select>
            </label>
          </>
        ) : null}
        <button
          type="button"
          disabled={!ready}
          onClick={submit}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
          {market === "futures" ? "Search Futures" : "Search Options"}
        </button>
      </div>
    </section>
  );
}

// ── futures quote ──────────────────────────────────────────────────────────

function QuoteField({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold tabular-nums text-foreground ${className}`}>{value}</span>
    </div>
  );
}

function FuturesQuoteCard({
  futures,
  selection,
  onSelect,
  indexSymbols,
}: {
  readonly futures: readonly FutureRow[];
  readonly selection: { symbol: string; expiry: string | null };
  readonly onSelect: (symbol: string, expiry: string | null) => void;
  readonly indexSymbols: readonly string[];
}) {
  const contracts = futures.filter((row) => row.symbol === selection.symbol).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const row = contracts.find((item) => item.expiry === selection.expiry) ?? contracts[0] ?? null;
  const totalOi = contracts.reduce((sum, item) => sum + (item.oi ?? 0), 0);
  const nearOi = contracts[0]?.oi ?? null;
  const rollover = totalOi > 0 && nearOi !== null ? ((totalOi - nearOi) / totalOi) * 100 : null;
  const rolloverCost = contracts[1]?.ltp != null && contracts[0]?.ltp != null ? contracts[1].ltp - contracts[0].ltp : null;
  const isIndex = row?.isIndex ?? indexSymbols.includes(selection.symbol);

  return (
    <Card
      title={
        <span>
          {isIndex ? "Index Futures" : "Stock Futures"} <span className="text-primary">{selection.symbol}</span>
        </span>
      }
      actions={
        <Select label="Index futures" value={indexSymbols.includes(selection.symbol) ? selection.symbol : ""} onChange={(value) => value && onSelect(value, null)}>
          {!indexSymbols.includes(selection.symbol) ? <option value="">Select index</option> : null}
          {indexSymbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </Select>
      }
    >
      {!row ? (
        <Empty>No futures contract for {selection.symbol}.</Empty>
      ) : (
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {isIndex ? row.symbol : <StockLink symbol={row.symbol} isIndex={false} />} {expiryLabel(row.expiry)}
                {!isIndex ? <span className="ml-1 font-normal">· {row.name}</span> : null}
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-extrabold tabular-nums text-foreground">{fmt(row.ltp)}</span>
                <span className={`text-sm font-bold tabular-nums ${tone(row.change)}`}>
                  {signed(row.change)} ({signed(row.changePct, 2, "%")})
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.buildup ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BUILDUP_STYLE[row.buildup]}`}>{BUILDUP_LABEL[row.buildup]}</span>
              ) : null}
              {contracts.length > 1 ? (
                <Segmented
                  size="xs"
                  options={contracts.map((item, index) => ({ id: item.expiry, label: SERIES[index]?.label ?? expiryLabel(item.expiry) }))}
                  value={row.expiry}
                  onChange={(expiry) => onSelect(row.symbol, expiry)}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
            <div>
              <QuoteField label="Open" value={fmt(row.open)} />
              <QuoteField label="High" value={fmt(row.high)} />
              <QuoteField label="Low" value={fmt(row.low)} />
              <QuoteField label="Prev. Close" value={fmt(row.prevClose)} />
              <QuoteField label="Bid Price" value={fmt(row.bid)} />
              <QuoteField label="Offer Price" value={fmt(row.ask)} />
              <QuoteField label={isIndex ? "Index Value" : "Cash Price"} value={fmt(row.spot)} />
              <QuoteField label="Basis" value={<span className={tone(row.basis)}>{signed(row.basis)} ({signed(row.basisPct, 2, "%")})</span>} />
            </div>
            <div>
              <QuoteField label="Avg. Price" value={fmt(row.avgPrice)} />
              <QuoteField label="Contracts Traded" value={int(row.contracts)} />
              <QuoteField label="Turnover (₹ lakh)" value={fmt(row.turnoverLakh)} />
              <QuoteField label="Market Lot" value={int(row.lotSize)} />
              <QuoteField label="Open Interest" value={int(row.oi)} />
              <QuoteField label="Open Int. Chg" value={<span className={tone(row.oiChange)}>{signed(row.oiChange, 0)}</span>} />
              <QuoteField label="OI Chg %" value={<Pct value={row.oiChangePct} />} />
              <QuoteField label="Rollover % / Cost" value={`${fmt(rollover)}% / ${signed(rolloverCost)}`} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── option chain ───────────────────────────────────────────────────────────

function LegCells({ leg, side, detailed, itm }: { leg: OptionLeg | null; side: "call" | "put"; detailed: boolean; itm: boolean }) {
  const shade = itm ? "bg-amber-500/[0.07]" : "";
  const premium = (
    <td className={`${TD} ${shade} text-right`}>
      <span className="font-semibold text-foreground">{fmt(leg?.ltp)}</span>
      <span className={`block text-[10px] ${tone(leg?.changePct)}`}>{leg?.changePct != null ? `(${signed(leg.changePct, 2, "%")})` : ""}</span>
    </td>
  );
  const volume = <td className={`${TD} ${shade} text-right`}>{int(leg?.volume)}</td>;
  const oi = (
    <td className={`${TD} ${shade} text-right`}>
      <span className="text-foreground">{int(leg?.oi)}</span>
      <span className={`block text-[10px] ${tone(leg?.oiChangePct)}`}>{leg?.oiChangePct != null ? `(${signed(leg.oiChangePct, 2, "%")})` : ""}</span>
    </td>
  );
  const extra = detailed
    ? [
        <td key="chg" className={`${TD} ${shade} text-right ${tone(leg?.oiChange)}`}>{signed(leg?.oiChange, 0)}</td>,
        <td key="iv" className={`${TD} ${shade} text-right`}>{fmt(leg?.iv)}</td>,
        <td key="bid" className={`${TD} ${shade} text-right`}>{fmt(leg?.bid)}</td>,
        <td key="ask" className={`${TD} ${shade} text-right`}>{fmt(leg?.ask)}</td>,
      ]
    : [];
  return side === "call" ? (
    <>
      {premium}
      {extra.slice().reverse()}
      {volume}
      {oi}
    </>
  ) : (
    <>
      {oi}
      {volume}
      {extra}
      {premium}
    </>
  );
}

function OptionChainCard({
  symbol,
  onSymbol,
  indexSymbols,
  monthly,
  highlight,
}: {
  readonly symbol: string;
  readonly onSymbol: (symbol: string) => void;
  readonly indexSymbols: readonly string[];
  readonly monthly: readonly string[];
  readonly highlight: OptionSearch | null;
}) {
  // The parent remounts this card (key) when the underlying or a searched option changes.
  const [series, setSeries] = useState<ExpirySeries>("near");
  const [expiryOverride, setExpiryOverride] = useState<string | null>(highlight && highlight.symbol === symbol ? highlight.expiry : null);
  const [detailed, setDetailed] = useState(false);
  const seriesExpiry = monthly[SERIES.findIndex((item) => item.id === series)] ?? monthly[0] ?? null;
  const expiry = expiryOverride ?? seriesExpiry;
  const { chain, error, loading } = useOptionChain(symbol, expiry);

  const rows: OptionChainRow[] = useMemo(() => {
    if (!chain) return [];
    if (detailed) return [...chain.rows];
    const at = chain.rows.findIndex((row) => row.strike === chain.atmStrike);
    if (at < 0) return chain.rows.slice(0, CHAIN_STRIKES_EACH_SIDE * 2 + 1);
    let from = Math.max(0, at - CHAIN_STRIKES_EACH_SIDE);
    if (highlight && highlight.symbol === symbol) {
      const target = chain.rows.findIndex((row) => row.strike === highlight.strike);
      if (target >= 0 && (target < from || target > at + CHAIN_STRIKES_EACH_SIDE)) from = Math.max(0, target - CHAIN_STRIKES_EACH_SIDE);
    }
    return chain.rows.slice(from, from + CHAIN_STRIKES_EACH_SIDE * 2 + 1);
  }, [chain, detailed, highlight, symbol]);

  const spot = chain?.underlyingValue ?? null;
  const detailCols = detailed ? 4 : 0;

  return (
    <Card
      className={detailed ? "xl:col-span-2" : ""}
      title={
        <span>
          Option Chain <span className="text-primary">{symbol}</span>
        </span>
      }
      actions={
        <>
          <Select label="Option chain underlying" value={indexSymbols.includes(symbol) ? symbol : ""} onChange={(value) => value && onSymbol(value)}>
            {!indexSymbols.includes(symbol) ? <option value="">{symbol}</option> : null}
            {indexSymbols.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Segmented
            size="xs"
            options={SERIES.slice(0, Math.max(1, monthly.length))}
            value={expiryOverride && !monthly.includes(expiryOverride) ? ("" as ExpirySeries) : series}
            onChange={(value) => {
              setSeries(value);
              setExpiryOverride(null);
            }}
          />
          {detailed && chain ? (
            <Select label="Expiry" value={chain.expiry} onChange={(value) => setExpiryOverride(value)}>
              {chain.expiries.map((date) => (
                <option key={date} value={date}>
                  {expiryLabel(date)}
                </option>
              ))}
            </Select>
          ) : null}
        </>
      }
      footer={
        <button type="button" onClick={() => setDetailed((value) => !value)} className="font-semibold text-primary hover:underline">
          {detailed ? "Compact View" : "Detailed View"}
        </button>
      }
    >
      {chain ? (
        <div className="grid grid-cols-2 gap-px border-b border-border bg-border text-center sm:grid-cols-5">
          {[
            { label: "Expiry", value: expiryLabel(chain.expiry) },
            { label: symbol, value: fmt(spot) },
            { label: "PCR (OI)", value: fmt(chain.pcr) },
            { label: "Max Pain", value: fmt(chain.maxPain, 0) },
            { label: "Call / Put OI", value: `${(chain.totals.callOi / 1e5).toFixed(1)}L / ${(chain.totals.putOi / 1e5).toFixed(1)}L` },
          ].map((item) => (
            <div key={item.label} className="bg-card px-2 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="text-xs font-bold tabular-nums text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {error && !chain ? <Empty>{error}</Empty> : null}
      {!chain && !error ? <Empty>{loading ? "Loading option chain…" : "No option chain."}</Empty> : null}
      {chain ? (
        <div className={`overflow-x-auto ${detailed ? "max-h-[640px] overflow-y-auto" : ""}`}>
          <table className="w-full min-w-[560px] border-collapse">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th colSpan={3 + detailCols} className={`${TH} border-b border-border text-center text-emerald-700 dark:text-emerald-400`}>
                  Calls
                </th>
                <th className={`${TH} border-b border-border`} />
                <th colSpan={3 + detailCols} className={`${TH} border-b border-border text-center text-rose-700 dark:text-rose-400`}>
                  Puts
                </th>
              </tr>
              <tr>
                <th className={`${TH} text-right`}>Premium</th>
                {detailed ? ["Ask", "Bid", "IV", "Chg OI"].map((label) => <th key={`c${label}`} className={`${TH} text-right`}>{label}</th>) : null}
                <th className={`${TH} text-right`}>Volume</th>
                <th className={`${TH} text-right`}>Open Int</th>
                <th className={`${TH} bg-muted text-center text-foreground`}>Strike Price</th>
                <th className={`${TH} text-right`}>Open Int</th>
                <th className={`${TH} text-right`}>Volume</th>
                {detailed ? ["Chg OI", "IV", "Bid", "Ask"].map((label) => <th key={`p${label}`} className={`${TH} text-right`}>{label}</th>) : null}
                <th className={`${TH} text-right`}>Premium</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const atm = row.strike === chain.atmStrike;
                const hit = highlight && highlight.symbol === symbol && highlight.strike === row.strike && highlight.expiry === chain.expiry;
                return (
                  <tr key={row.strike} className={`border-b border-border/60 hover:bg-muted/50 ${hit ? "outline outline-2 -outline-offset-2 outline-primary" : ""}`}>
                    <LegCells leg={row.call} side="call" detailed={detailed} itm={spot !== null && row.strike < spot} />
                    <td className={`${TD} text-center font-bold ${atm ? "bg-primary/15 text-primary" : "bg-muted/60 text-foreground"}`}>{fmt(row.strike, row.strike % 1 === 0 ? 2 : 2)}</td>
                    <LegCells leg={row.put} side="put" detailed={detailed} itm={spot !== null && row.strike > spot} />
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-1.5 text-[10px] text-muted-foreground">
            Shaded cells are in the money · OI and volume in shares · NSE {chain.asOf ?? ""}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function OptionQuoteCard({ search, onClose }: { search: OptionSearch; onClose: () => void }) {
  const { chain, error } = useOptionChain(search.symbol, search.expiry);
  const row = chain?.rows.find((item) => item.strike === search.strike) ?? null;
  const leg = row ? (search.type === "CE" ? row.call : row.put) : null;
  const intrinsic =
    chain?.underlyingValue != null ? Math.max(0, search.type === "CE" ? chain.underlyingValue - search.strike : search.strike - chain.underlyingValue) : null;
  return (
    <Card
      title={
        <span>
          {search.symbol} {expiryLabel(search.expiry)} <span className="text-primary">{fmt(search.strike, search.strike % 1 === 0 ? 0 : 2)} {search.type}</span>
        </span>
      }
      actions={
        <button type="button" onClick={onClose} aria-label="Close option quote" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      }
    >
      {!leg ? (
        <Empty>{error ?? (chain ? "No quote for this strike." : "Loading…")}</Empty>
      ) : (
        <div className="px-4 py-3">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-foreground">{fmt(leg.ltp)}</span>
            <span className={`text-sm font-bold tabular-nums ${tone(leg.change)}`}>
              {signed(leg.change)} ({signed(leg.changePct, 2, "%")})
            </span>
          </p>
          <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
            <div>
              <QuoteField label="Underlying" value={fmt(chain?.underlyingValue)} />
              <QuoteField label="Intrinsic Value" value={fmt(intrinsic)} />
              <QuoteField label="Time Value" value={fmt(leg.ltp !== null && intrinsic !== null ? leg.ltp - intrinsic : null)} />
              <QuoteField label="Implied Volatility" value={leg.iv !== null ? `${fmt(leg.iv)}%` : "—"} />
              <QuoteField label="Market Lot" value={int(chain?.lotSize)} />
            </div>
            <div>
              <QuoteField label="Volume" value={int(leg.volume)} />
              <QuoteField label="Open Interest" value={int(leg.oi)} />
              <QuoteField label="Open Int. Chg" value={<span className={tone(leg.oiChange)}>{signed(leg.oiChange, 0)} ({signed(leg.oiChangePct, 2, "%")})</span>} />
              <QuoteField label="Bid (Qty)" value={`${fmt(leg.bid)} (${int(leg.bidQty)})`} />
              <QuoteField label="Offer (Qty)" value={`${fmt(leg.ask)} (${int(leg.askQty)})`} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── F&O stats ──────────────────────────────────────────────────────────────

type StatTab =
  | "gainers"
  | "losers"
  | "calls"
  | "puts"
  | "activeShares"
  | "activeValue"
  | "oiUp"
  | "oiDown"
  | "long-buildup"
  | "short-buildup"
  | "short-covering"
  | "long-unwinding";

const STAT_TABS: readonly { id: StatTab; label: string }[] = [
  { id: "gainers", label: "Top Gainers" },
  { id: "losers", label: "Top Losers" },
  { id: "calls", label: "Active Calls" },
  { id: "puts", label: "Active Puts" },
];
const MORE_STAT_TABS: readonly { id: StatTab; label: string }[] = [
  { id: "activeShares", label: "Most Active (Shares)" },
  { id: "activeValue", label: "Most Active (Value)" },
  { id: "oiUp", label: "Increase in Open Interest" },
  { id: "oiDown", label: "Decrease in Open Interest" },
  { id: "long-buildup", label: "Long Build-up" },
  { id: "short-buildup", label: "Short Build-up" },
  { id: "short-covering", label: "Short Covering" },
  { id: "long-unwinding", label: "Long Unwinding" },
];

function FuturesStatTable({ rows, tab }: { rows: readonly FutureRow[]; tab: StatTab }) {
  const metric =
    tab === "activeShares"
      ? { label: "Contracts", value: (row: FutureRow) => int(row.contracts) }
      : tab === "activeValue"
        ? { label: "Value (₹ lakh)", value: (row: FutureRow) => fmt(row.turnoverLakh) }
        : tab === "oiUp" || tab === "oiDown" || tab.includes("-")
          ? { label: "OI Chg %", value: (row: FutureRow) => <Pct value={row.oiChangePct} /> }
          : null;
  return (
    <table className="w-full border-collapse">
      <thead className="border-b border-border bg-muted/60">
        <tr>
          <th className={`${TH} text-left`}>Futures</th>
          <th className={`${TH} text-right`}>CMP</th>
          <th className={`${TH} text-right`}>Change</th>
          <th className={`${TH} text-right`}>% Chg</th>
          {metric ? <th className={`${TH} text-right`}>{metric.label}</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.securityId} className="border-b border-border/60 hover:bg-muted/50">
            <td className={`${TD}`}>
              <StockLink symbol={row.symbol} isIndex={row.isIndex} /> <span className="text-muted-foreground">{expiryLabel(row.expiry)}</span>
            </td>
            <td className={`${TD} text-right font-semibold text-foreground`}>{fmt(row.ltp)}</td>
            <td className={`${TD} text-right ${tone(row.change)}`}>{signed(row.change)}</td>
            <td className={`${TD} text-right`}>
              <Pct value={row.changePct} />
            </td>
            {metric ? <td className={`${TD} text-right`}>{metric.value(row)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActiveOptionsTable({ rows }: { rows: readonly ActiveOption[] }) {
  return (
    <table className="w-full border-collapse">
      <thead className="border-b border-border bg-muted/60">
        <tr>
          <th className={`${TH} text-left`}>Contract</th>
          <th className={`${TH} text-right`}>LTP</th>
          <th className={`${TH} text-right`}>% Chg</th>
          <th className={`${TH} text-right`}>Contracts</th>
          <th className={`${TH} text-right`}>Premium (₹ lakh)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.symbol}${row.expiry}${row.strike}${row.optionType}`} className="border-b border-border/60 hover:bg-muted/50">
            <td className={TD}>
              <span className="font-semibold text-foreground">{row.symbol}</span>{" "}
              <span className="text-muted-foreground">
                {expiryLabel(row.expiry)} {fmt(row.strike, row.strike % 1 === 0 ? 0 : 2)} {row.optionType}
              </span>
            </td>
            <td className={`${TD} text-right font-semibold text-foreground`}>{fmt(row.ltp)}</td>
            <td className={`${TD} text-right`}>
              <Pct value={row.changePct} />
            </td>
            <td className={`${TD} text-right`}>{int(row.contracts)}</td>
            <td className={`${TD} text-right`}>{fmt(row.premiumLakh)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatsCard({ data }: { data: FnoSnapshotResponse }) {
  const [tab, setTab] = useState<StatTab>("gainers");
  const [series, setSeries] = useState<ExpirySeries>("near");
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? 50 : 8;

  const futures = useMemo(() => data.futures.filter((row) => row.series === series && row.ltp !== null), [data.futures, series]);
  const futuresRows = useMemo(() => {
    const by = (value: (row: FutureRow) => number | null, dir: "asc" | "desc", filter?: (row: FutureRow) => boolean) =>
      sortRows(filter ? futures.filter(filter) : futures, value, dir);
    switch (tab) {
      case "gainers":
        return by((row) => row.changePct, "desc", (row) => (row.changePct ?? 0) > 0);
      case "losers":
        return by((row) => row.changePct, "asc", (row) => (row.changePct ?? 0) < 0);
      case "activeShares":
        return by((row) => row.contracts, "desc");
      case "activeValue":
        return by((row) => row.turnoverLakh, "desc");
      case "oiUp":
        return by((row) => row.oiChangePct, "desc", (row) => (row.oiChange ?? 0) > 0);
      case "oiDown":
        return by((row) => row.oiChangePct, "asc", (row) => (row.oiChange ?? 0) < 0);
      case "long-buildup":
      case "short-buildup":
      case "short-covering":
      case "long-unwinding":
        return by((row) => Math.abs(row.oiChangePct ?? 0), "desc", (row) => row.buildup === tab);
      default:
        return [];
    }
  }, [futures, tab]);

  const options = tab === "calls" ? data.activeCalls : tab === "puts" ? data.activePuts : null;
  const total = options ? options.length : futuresRows.length;
  const pick = (value: StatTab) => {
    setTab(value);
    setExpanded(false);
  };

  return (
    <Card
      title="F&O Stats"
      actions={!options ? <Segmented size="xs" options={SERIES} value={series} onChange={setSeries} /> : null}
      footer={<MoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} total={total} shown={8} />}
    >
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2" role="tablist">
        {STAT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => pick(item.id)}
            className={`whitespace-nowrap px-3 py-2 text-xs font-semibold ${tab === item.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {options ? (
          options.length ? <ActiveOptionsTable rows={options.slice(0, shown)} /> : <Empty>No option activity reported yet.</Empty>
        ) : futuresRows.length ? (
          <FuturesStatTable rows={futuresRows.slice(0, shown)} tab={tab} />
        ) : (
          <Empty>No contracts in this list right now.</Empty>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-4 py-2">
        {MORE_STAT_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => pick(item.id)}
            className={`text-[11px] font-semibold ${tab === item.id ? "text-primary underline" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── sector OI & volume ─────────────────────────────────────────────────────

function SectorCard({ data }: { data: FnoSnapshotResponse }) {
  const near = useMemo(() => data.futures.filter((row) => row.series === "near" && !row.isIndex), [data.futures]);
  const sectors = useMemo(() => [...new Set(near.map((row) => row.sector).filter((value): value is string => !!value))].sort(), [near]);
  const indices = Object.keys(data.indexMembers).filter((name) => data.indexMembers[name]!.length > 0);
  const [filter, setFilter] = useState<string>("sector:Banks");
  const [metric, setMetric] = useState<"oi" | "volume">("oi");
  const [sort, setSort] = useState<SortState<"symbol" | "price" | "oi" | "oiPct">>({ key: "oiPct", dir: "desc" });
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    const [kind, value] = [filter.slice(0, filter.indexOf(":")), filter.slice(filter.indexOf(":") + 1)];
    const members = kind === "index" ? new Set(data.indexMembers[value] ?? []) : null;
    const list = near.filter((row) => (members ? members.has(row.symbol) : row.sector === value));
    const volumePct = (row: FutureRow) => (row.volume !== null && row.prevVolume ? ((row.volume - row.prevVolume) / row.prevVolume) * 100 : null);
    const value_ = (row: FutureRow): number | string | null =>
      sort.key === "symbol"
        ? row.symbol
        : sort.key === "price"
          ? row.changePct
          : sort.key === "oi"
            ? metric === "oi"
              ? row.oi
              : row.volume
            : metric === "oi"
              ? row.oiChangePct
              : volumePct(row);
    return { list: sortRows(list, value_, sort.dir), volumePct };
  }, [filter, near, data.indexMembers, sort, metric]);

  const onSort = (key: "symbol" | "price" | "oi" | "oiPct") => setSort((value) => nextSort(value, key, key === "symbol"));
  const shown = expanded ? rows.list : rows.list.slice(0, 12);

  return (
    <Card
      title="Sector Wise Open Interest & Volume"
      actions={
        <>
          <Select label="Sector or index" value={filter} onChange={(value) => { setFilter(value); setExpanded(false); }} className="max-w-[200px]">
            <optgroup label="Sector">
              {sectors.map((sector) => (
                <option key={sector} value={`sector:${sector}`}>
                  {sector}
                </option>
              ))}
            </optgroup>
            <optgroup label="Index">
              {indices.map((name) => (
                <option key={name} value={`index:${name}`}>
                  {name}
                </option>
              ))}
            </optgroup>
          </Select>
          <Segmented
            size="xs"
            options={[
              { id: "oi", label: "OI" },
              { id: "volume", label: "Volume" },
            ]}
            value={metric}
            onChange={setMetric}
          />
        </>
      }
      footer={<MoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} total={rows.list.length} shown={12} />}
    >
      {rows.list.length === 0 ? (
        <Empty>No F&O stocks in this group.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <SortableTh label="Stock" sortKey="symbol" sort={sort} onSort={onSort} className={TH} />
                <SortableTh label="CMP (% Chg)" sortKey="price" sort={sort} onSort={onSort} align="right" className={TH} />
                <SortableTh label={metric === "oi" ? "Open Int" : "Volume"} sortKey="oi" sort={sort} onSort={onSort} align="right" className={TH} />
                <SortableTh label="% Chg" sortKey="oiPct" sort={sort} onSort={onSort} align="right" className={TH} />
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.securityId} className="border-b border-border/60 hover:bg-muted/50">
                  <td className={TD}>
                    <StockLink symbol={row.symbol} isIndex={false} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <span className="font-semibold text-foreground">{fmt(row.ltp)}</span> <Pct value={row.changePct} className="text-[11px]" />
                  </td>
                  <td className={`${TD} text-right`}>{int(metric === "oi" ? row.oi : row.volume)}</td>
                  <td className={`${TD} text-right`}>
                    <Pct value={metric === "oi" ? row.oiChangePct : rows.volumePct(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── OI breakup & arbitrage ─────────────────────────────────────────────────

function OiBreakupCard({ data }: { data: FnoSnapshotResponse }) {
  const [series, setSeries] = useState<ExpirySeries>("near");
  const [sort, setSort] = useState<SortState<"symbol" | "oi" | "change" | "pct">>({ key: "oi", dir: "desc" });
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => {
    const list = data.futures.filter((row) => row.series === series);
    const value = (row: FutureRow) =>
      sort.key === "symbol" ? row.symbol : sort.key === "oi" ? row.oi : sort.key === "change" ? row.oiChange : row.oiChangePct;
    return sortRows(list, value, sort.dir);
  }, [data.futures, series, sort]);
  const onSort = (key: "symbol" | "oi" | "change" | "pct") => setSort((value) => nextSort(value, key, key === "symbol"));
  const shown = expanded ? rows : rows.slice(0, 10);
  return (
    <Card
      title="Open Interest Breakup"
      actions={<Segmented size="xs" options={SERIES} value={series} onChange={setSeries} />}
      footer={<MoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} total={rows.length} shown={10} />}
    >
      <div className={`overflow-x-auto ${expanded ? "max-h-[560px] overflow-y-auto" : ""}`}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 border-b border-border bg-muted">
            <tr>
              <SortableTh label="Symbol" sortKey="symbol" sort={sort} onSort={onSort} className={TH} />
              <SortableTh label="Total OI" sortKey="oi" sort={sort} onSort={onSort} align="right" className={TH} />
              <SortableTh label="Change" sortKey="change" sort={sort} onSort={onSort} align="right" className={TH} />
              <SortableTh label="% Chg" sortKey="pct" sort={sort} onSort={onSort} align="right" className={TH} />
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.securityId} className="border-b border-border/60 hover:bg-muted/50">
                <td className={TD}>
                  <StockLink symbol={row.symbol} isIndex={row.isIndex} /> <span className="text-muted-foreground">{expiryLabel(row.expiry)}</span>
                </td>
                <td className={`${TD} text-right font-semibold text-foreground`}>{int(row.oi)}</td>
                <td className={`${TD} text-right ${tone(row.oiChange)}`}>{signed(row.oiChange, 0)}</td>
                <td className={`${TD} text-right`}>
                  <Pct value={row.oiChangePct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ArbitrageCard({ data }: { data: FnoSnapshotResponse }) {
  const [sort, setSort] = useState<SortState<"symbol" | "future" | "cash" | "basis" | "basisPct">>({ key: "basis", dir: "desc" });
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const list = data.futures.filter(
      (row) => row.series === "near" && !row.isIndex && row.basis !== null && (!needle || row.symbol.includes(needle) || row.name.toUpperCase().includes(needle)),
    );
    const value = (row: FutureRow) =>
      sort.key === "symbol" ? row.symbol : sort.key === "future" ? row.ltp : sort.key === "cash" ? row.spot : sort.key === "basis" ? row.basis : row.basisPct;
    return sortRows(list, value, sort.dir);
  }, [data.futures, sort, query]);
  const onSort = (key: "symbol" | "future" | "cash" | "basis" | "basisPct") => setSort((value) => nextSort(value, key, key === "symbol"));
  return (
    <Card
      title="Arbitrage"
      actions={
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find stock"
            aria-label="Find stock in arbitrage table"
            className="w-36 rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </div>
      }
    >
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 border-b border-border bg-muted">
            <tr>
              <SortableTh label="Company" sortKey="symbol" sort={sort} onSort={onSort} className={TH} />
              <SortableTh label="Future" sortKey="future" sort={sort} onSort={onSort} align="right" className={TH} />
              <SortableTh label="Cash" sortKey="cash" sort={sort} onSort={onSort} align="right" className={TH} />
              <SortableTh label="Basis" sortKey="basis" sort={sort} onSort={onSort} align="right" className={TH} />
              <SortableTh label="Basis %" sortKey="basisPct" sort={sort} onSort={onSort} align="right" className={TH} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.securityId} className="border-b border-border/60 hover:bg-muted/50">
                <td className={TD}>
                  <StockLink symbol={row.symbol} isIndex={false} />
                </td>
                <td className={`${TD} text-right text-foreground`}>{fmt(row.ltp)}</td>
                <td className={`${TD} text-right text-foreground`}>{fmt(row.spot)}</td>
                <td className={`${TD} text-right font-semibold ${tone(row.basis)}`}>{fmt(row.basis)}</td>
                <td className={`${TD} text-right ${tone(row.basisPct)}`}>{fmt(row.basisPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <Empty>No matching stock futures.</Empty> : null}
      </div>
    </Card>
  );
}

// ── right-hand cards ───────────────────────────────────────────────────────

function AnnouncementsCard({ data }: { data: FnoSnapshotResponse }) {
  return (
    <Card title="Announcements on F&O Stocks">
      {data.announcements.length === 0 ? (
        <Empty>No filings from F&O companies in the last few days.</Empty>
      ) : (
        <ul className="max-h-[440px] divide-y divide-border/60 overflow-y-auto">
          {data.announcements.map((item) => (
            <li key={`${item.symbol}${item.at}${item.subject}`} className="px-4 py-2">
              <p className="text-[11px] text-muted-foreground">
                {item.at.slice(0, 17)} · <StockLink symbol={item.symbol} isIndex={false} />
              </p>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="group text-xs font-semibold text-foreground hover:text-primary">
                  {item.subject}
                  <ExternalLink className="ml-1 inline h-3 w-3 opacity-50 group-hover:opacity-100" />
                </a>
              ) : (
                <p className="text-xs font-semibold text-foreground">{item.subject}</p>
              )}
              {item.detail ? <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.detail}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface GlobalRow {
  name: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
}

function GlobalIndicesCard() {
  const [groups, setGroups] = useState<{ label: string; rows: GlobalRow[] }[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/market-data/global-markets", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = (unwrapApiEnvelope(await response.json()) as { sections?: { id: string; groups: { label: string; rows: GlobalRow[] }[] }[] });
        const section = body.sections?.find((item) => item.id === "indices");
        setGroups(section?.groups ?? []);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), GLOBAL_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);
  return (
    <Card
      title="Global Indices"
      footer={
        <Link href="/market-data/global-markets" className="font-semibold text-primary hover:underline">
          Detailed View
        </Link>
      }
    >
      {!groups ? (
        <Empty>{failed ? "Global indices are unavailable right now." : "Loading…"}</Empty>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-border bg-muted">
              <tr>
                <th className={`${TH} text-left`}>Index</th>
                <th className={`${TH} text-right`}>CMP</th>
                <th className={`${TH} text-right`}>Change</th>
                <th className={`${TH} text-right`}>% Chg</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GlobalGroup key={group.label} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function GlobalGroup({ group }: { group: { label: string; rows: GlobalRow[] } }) {
  return (
    <>
      <tr className="bg-muted/40">
        <td colSpan={4} className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {group.label}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.name} className="border-b border-border/60 hover:bg-muted/50">
          <td className={`${TD} font-semibold text-foreground`}>{row.name}</td>
          <td className={`${TD} text-right text-foreground`}>{fmt(row.price)}</td>
          <td className={`${TD} text-right ${tone(row.change)}`}>{signed(row.change)}</td>
          <td className={`${TD} text-right`}>
            <Pct value={row.changePct} />
          </td>
        </tr>
      ))}
    </>
  );
}

function CorporateActionCard({ data }: { data: FnoSnapshotResponse }) {
  const today = istToday();
  const upcoming = data.corporateActions.filter((item) => item.exDate >= today);
  const recent = data.corporateActions.filter((item) => item.exDate < today).reverse();
  const rows = [...upcoming, ...recent];
  return (
    <Card title="Corporate Action">
      {rows.length === 0 ? (
        <Empty>No corporate actions for F&O stocks in the coming month.</Empty>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 border-b border-border bg-muted">
              <tr>
                <th className={`${TH} text-left`}>Stock</th>
                <th className={`${TH} text-left`}>Ex-Date</th>
                <th className={`${TH} text-left`}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={`${item.symbol}${item.exDate}${item.purpose}`} className={`border-b border-border/60 hover:bg-muted/50 ${item.exDate < today ? "opacity-60" : ""}`}>
                  <td className={TD}>
                    <StockLink symbol={item.symbol} isIndex={false} />
                  </td>
                  <td className={`${TD} text-foreground`}>{dayLabel(item.exDate)}</td>
                  <td className="px-3 py-1.5 text-xs text-foreground">{item.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BreadthCard({ data }: { data: FnoSnapshotResponse }) {
  const { futures, calls, puts, optionsDate } = data.advanceDecline;
  const cell = (value: number, total: number) => (
    <>
      {int(value)} <span className="text-muted-foreground">({total > 0 ? Math.round((value / total) * 100) : 0}%)</span>
    </>
  );
  const columns = [
    { label: "Future", ad: futures },
    { label: "Calls", ad: calls },
    { label: "Puts", ad: puts },
  ];
  return (
    <Card title="Advance Decline Table">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-border bg-muted/60">
            <tr>
              <th className={`${TH} text-left`} />
              {columns.map((column) => (
                <th key={column.label} className={`${TH} text-right`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["advanced", "declined", "unchanged"] as const).map((key) => (
              <tr key={key} className="border-b border-border/60">
                <td className={`${TD} font-semibold capitalize ${key === "advanced" ? "text-emerald-600 dark:text-emerald-400" : key === "declined" ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                  {key}
                </td>
                {columns.map((column) => (
                  <td key={column.label} className={`${TD} text-right text-foreground`}>
                    {column.ad ? cell(column.ad[key], column.ad.total) : "—"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className={`${TD} font-bold text-foreground`}>Total</td>
              {columns.map((column) => (
                <td key={column.label} className={`${TD} text-right font-bold text-foreground`}>
                  {column.ad ? int(column.ad.total) : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-4 py-1.5 text-[10px] text-muted-foreground">
        Futures: near-month contracts{data.session.live ? ", live" : ""}. Calls / puts: contracts traded on {dayLabel(optionsDate)} (NSE bhavcopy).
      </p>
      {data.volumeBreakup.segments.length ? (
        <>
          <div className="border-t border-border px-4 py-2 text-xs font-bold text-foreground">Volume Breakup · {dayLabel(data.volumeBreakup.date)}</div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-border bg-muted/60">
                <tr>
                  <th className={`${TH} text-left`}>Segment</th>
                  <th className={`${TH} text-right`}>Contracts</th>
                  <th className={`${TH} text-right`}>Share</th>
                  <th className={`${TH} text-right`}>Turnover (₹ cr)</th>
                  <th className={`${TH} text-right`}>OI (contracts)</th>
                </tr>
              </thead>
              <tbody>
                {data.volumeBreakup.segments.map((segment) => (
                  <tr key={segment.segment} className="border-b border-border/60">
                    <td className={`${TD} font-semibold text-foreground`}>{segment.segment}</td>
                    <td className={`${TD} text-right text-foreground`}>{int(segment.contracts)}</td>
                    <td className={`${TD} text-right text-foreground`}>{fmt(segment.share)}%</td>
                    <td className={`${TD} text-right text-foreground`}>{fmt(segment.turnoverCr, 0)}</td>
                    <td className={`${TD} text-right text-foreground`}>{int(segment.oiContracts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-1.5 text-[10px] text-muted-foreground">Options turnover is notional (strike + premium) value.</p>
        </>
      ) : null}
    </Card>
  );
}

function BanCard({ data }: { data: FnoSnapshotResponse }) {
  return (
    <Card title={`Securities in Ban Period${data.ban.tradeDate ? ` for ${dayLabel(data.ban.tradeDate)}` : ""}`}>
      {data.ban.symbols.length === 0 ? (
        <Empty>No securities are in the F&O ban period.</Empty>
      ) : (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {data.ban.symbols.map((symbol) => {
            const name = data.futures.find((row) => row.symbol === symbol)?.name ?? symbol;
            return (
              <Link
                key={symbol}
                href={`/stock/${encodeURIComponent(symbol)}`}
                className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                title={name}
              >
                {symbol} <span className="font-normal opacity-80">· {name}</span>
              </Link>
            );
          })}
        </div>
      )}
      <p className="px-4 pb-2 text-[10px] text-muted-foreground">
        No fresh positions are allowed in these stocks&apos; derivatives until open interest falls below 80% of the market-wide limit.
      </p>
    </Card>
  );
}

function GlossaryCard() {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const terms = all ? FNO_GLOSSARY : FNO_GLOSSARY.slice(0, 12);
  return (
    <Card
      title="Glossary"
      footer={
        <MoreButton expanded={all} onClick={() => setAll((value) => !value)} total={FNO_GLOSSARY.length} shown={12} />
      }
    >
      <div className="grid gap-x-4 px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
        {terms.map((item) => (
          <div key={item.term} className="border-b border-border/60 py-1.5">
            <button
              type="button"
              onClick={() => setOpen(open === item.term ? null : item.term)}
              aria-expanded={open === item.term}
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-foreground hover:text-primary"
            >
              {item.term}
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open === item.term ? "rotate-180" : ""}`} />
            </button>
            {open === item.term ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.meaning}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function FaqCard() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Card title="FAQ">
      <div className="divide-y divide-border/60">
        {FNO_FAQ.map((item, index) => (
          <div key={item.question} className="px-4 py-2">
            <button
              type="button"
              onClick={() => setOpen(open === index ? null : index)}
              aria-expanded={open === index}
              className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-foreground hover:text-primary"
            >
              {item.question}
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === index ? "rotate-180" : ""}`} />
            </button>
            {open === index ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.answer}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function FnoSnapshotPage() {
  const { data, error, loading, refresh } = useSnapshot();
  const [futureSelection, setFutureSelection] = useState<{ symbol: string; expiry: string | null }>({ symbol: DEFAULT_INDEX, expiry: null });
  const [chainSymbol, setChainSymbol] = useState(DEFAULT_INDEX);
  const [optionSearch, setOptionSearch] = useState<OptionSearch | null>(null);

  const underlyings = useMemo(() => underlyingsOf(data?.futures ?? []), [data?.futures]);
  const indexSymbols = useMemo(() => {
    const order = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"];
    return underlyings
      .filter((item) => item.isIndex)
      .map((item) => item.symbol)
      .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  }, [underlyings]);
  const monthly = useMemo(() => underlyings.find((item) => item.symbol === chainSymbol)?.expiries.slice(0, 3) ?? [], [underlyings, chainSymbol]);

  const onOption = useCallback((search: OptionSearch) => {
    setOptionSearch(search);
    setChainSymbol(search.symbol);
  }, []);

  const status = data
    ? data.session.live
      ? `Live · session ${dayLabel(data.session.date)}`
      : `Session close · ${dayLabel(data.session.date)}`
    : loading
      ? "Loading…"
      : "Unavailable";

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">F&amp;O Market Snapshot</h1>
            <p className="text-xs text-muted-foreground">
              Every NSE futures contract, live option chains, open interest analytics and arbitrage — free
              {data?.session.referenceDate ? ` · OI and volume change vs ${dayLabel(data.session.referenceDate)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${error || (data?.degraded.length ?? 0) > 0 ? "bg-orange-500" : data?.session.live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground"}`} />
              {status}
            </span>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && !data ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{error}</div>
        ) : null}
        {data && data.degraded.length > 0 ? (
          <p className="mb-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
            Showing the last available data for: {data.degraded.join(", ")}.
          </p>
        ) : null}

        {!data && !error ? <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" /> : null}

        {data ? (
          <div className="flex flex-col gap-4">
            <SearchCard
              underlyings={underlyings}
              onFuture={(symbol, expiry) => {
                setFutureSelection({ symbol, expiry });
                setOptionSearch(null);
              }}
              onOption={onOption}
            />
            {optionSearch ? <OptionQuoteCard search={optionSearch} onClose={() => setOptionSearch(null)} /> : null}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <FuturesQuoteCard
                futures={data.futures}
                selection={futureSelection}
                onSelect={(symbol, expiry) => setFutureSelection({ symbol, expiry })}
                indexSymbols={indexSymbols}
              />
              <OptionChainCard
                key={`${chainSymbol}|${optionSearch ? `${optionSearch.expiry}|${optionSearch.strike}|${optionSearch.type}` : ""}`}
                symbol={chainSymbol} onSymbol={setChainSymbol} indexSymbols={indexSymbols} monthly={monthly} highlight={optionSearch} />
              <StatsCard data={data} />
              <AnnouncementsCard data={data} />
              <SectorCard data={data} />
              <GlobalIndicesCard />
              <OiBreakupCard data={data} />
              <ArbitrageCard data={data} />
              <CorporateActionCard data={data} />
              <div className="flex flex-col gap-4">
                <BanCard data={data} />
                <BreadthCard data={data} />
              </div>
            </div>
            <GlossaryCard />
            <FaqCard />
          </div>
        ) : null}
      </div>
    </div>
  );
}
