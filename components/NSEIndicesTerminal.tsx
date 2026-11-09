"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Search } from "lucide-react";
import { SortableTh } from "@/components/super-investors/SortableTh";
import type { IndexRow, IndexTab } from "@/lib/indices/catalog";
import type { ConstituentRow, IndexDetailResponse, IndexListResponse } from "@/lib/indices/service";
import type { TechnicalRating } from "@/lib/global-markets/compute";
import { nextSort, sortRows, type SortState } from "@/lib/super-investors/sorting";

const LIST_REFRESH_MS = 30_000;
const DETAIL_REFRESH_MS = 30_000;
const DEFAULT_INDEX = "NIFTY 50";

const TABS: readonly { id: IndexTab; label: string }[] = [
  { id: "key", label: "Key Indices" },
  { id: "sectoral", label: "Sectoral Indices" },
  { id: "other", label: "Other Indices" },
  { id: "largeCap", label: "Large Cap" },
  { id: "midCap", label: "Mid Cap" },
  { id: "smallCap", label: "Small Cap" },
  { id: "all", label: "All Indices" },
];

type View = "overview" | "technical" | "fundamental" | "performance" | "pivots";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "technical", label: "Technical" },
  { id: "fundamental", label: "Fundamental" },
  { id: "performance", label: "Performance" },
  { id: "pivots", label: "Pivot Level" },
];

const BUCKET_COLORS: Readonly<Record<string, string>> = {
  "lt-5": "#B91C1C",
  "-5to-3": "#EF4444",
  "-3to0": "#F87171",
  "0to3": "#4ADE80",
  "3to5": "#16A34A",
  gt5: "#15803D",
};

const RATING_RANK: Readonly<Record<TechnicalRating, number>> = {
  "Very Bearish": 0,
  Bearish: 1,
  Neutral: 2,
  Bullish: 3,
  "Very Bullish": 4,
};
const RATING_STYLE: Readonly<Record<TechnicalRating, string>> = {
  "Very Bullish": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Bullish: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Neutral: "bg-muted text-muted-foreground",
  Bearish: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  "Very Bearish": "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const TH = "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const TD = "whitespace-nowrap px-3 py-2 text-xs tabular-nums";

function fmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function tone(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "text-foreground";
  return value > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function Signed({ value, suffix = "", decimals = 2 }: { value: number | null | undefined; suffix?: string; decimals?: number }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`font-semibold ${tone(value)}`}>
      {value > 0 ? "+" : ""}
      {fmt(value, decimals)}
      {suffix}
    </span>
  );
}

interface Column {
  readonly key: string;
  readonly label: string;
  readonly value: (row: ConstituentRow) => number | string | null;
  readonly render: (row: ConstituentRow) => React.ReactNode;
}

const ratingCell = (row: ConstituentRow) =>
  row.technical?.rating ? (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${RATING_STYLE[row.technical.rating]}`}>{row.technical.rating}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

function columnsFor(view: View): Column[] {
  const ltp: Column = { key: "ltp", label: "LTP", value: (row) => row.price, render: (row) => <span className="font-semibold text-foreground">{fmt(row.price)}</span> };
  const chgPct: Column = { key: "chgPct", label: "%Chg", value: (row) => row.changePct, render: (row) => <Signed value={row.changePct} /> };
  const plain = (key: string, label: string, pick: (row: ConstituentRow) => number | null, decimals = 2): Column => ({
    key,
    label,
    value: pick,
    render: (row) => <span className="text-foreground">{fmt(pick(row), decimals)}</span>,
  });
  const rating: Column = { key: "rating", label: "Technical Rating", value: (row) => (row.technical?.rating ? RATING_RANK[row.technical.rating] : null), render: ratingCell };
  switch (view) {
    case "overview":
      return [
        ltp,
        chgPct,
        { key: "chg", label: "Chg", value: (row) => row.change, render: (row) => <Signed value={row.change} /> },
        { key: "volume", label: "Volume", value: (row) => row.volume, render: (row) => <span>{compact(row.volume)}</span> },
        { key: "value", label: "Value (₹ Cr)", value: (row) => row.value, render: (row) => <span>{row.value === null ? "—" : fmt(row.value / 1e7)}</span> },
        plain("open", "Open", (row) => row.open),
        plain("high", "High", (row) => row.high),
        plain("low", "Low", (row) => row.low),
        plain("prev", "Prev. Close", (row) => row.prevClose),
        rating,
      ];
    case "technical":
      return [
        ltp,
        chgPct,
        plain("sma20", "SMA 20", (row) => row.technical?.sma20 ?? null),
        plain("sma50", "SMA 50", (row) => row.technical?.sma50 ?? null),
        plain("sma200", "SMA 200", (row) => row.technical?.sma200 ?? null),
        {
          key: "rsi",
          label: "RSI (14)",
          value: (row) => row.technical?.rsi14 ?? null,
          render: (row) => {
            const value = row.technical?.rsi14 ?? null;
            const color = value === null ? "" : value >= 70 ? "text-rose-600 dark:text-rose-400" : value <= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
            return <span className={`font-semibold ${color}`}>{fmt(value, 1)}</span>;
          },
        },
        plain("macd", "MACD", (row) => row.technical?.macd ?? null),
        plain("signal", "MACD Signal", (row) => row.technical?.macdSignal ?? null),
        rating,
      ];
    case "fundamental":
      return [
        ltp,
        { key: "mcap", label: "Mkt Cap (₹ Cr)", value: (row) => row.marketCapCr, render: (row) => <span>{compact(row.marketCapCr)}</span> },
        plain("pe", "P/E", (row) => row.fundamentals?.pe ?? null),
        plain("pb", "P/B", (row) => row.fundamentals?.pb ?? null),
        plain("eps", "EPS (TTM)", (row) => row.fundamentals?.eps ?? null),
        plain("dy", "Div. Yield %", (row) => row.fundamentals?.dividendYield ?? null),
        plain("bv", "Book Value", (row) => row.fundamentals?.bookValue ?? null),
        plain("beta", "Beta", (row) => row.fundamentals?.beta ?? null),
        plain("h52", "52W High", (row) => row.high52),
        plain("l52", "52W Low", (row) => row.low52),
      ];
    case "performance":
      return [
        ltp,
        ...(
          [
            ["w1", "1 Week"],
            ["m1", "1 Month"],
            ["m3", "3 Months"],
            ["m6", "6 Months"],
            ["ytd", "YTD"],
            ["y1", "1 Year"],
            ["y3", "3 Years"],
            ["y5", "5 Years"],
          ] as const
        ).map(
          ([key, label]): Column => ({
            key,
            label: `${label} %`,
            value: (row) => row.performance[key],
            render: (row) => <Signed value={row.performance[key]} />,
          }),
        ),
      ];
    case "pivots": {
      const pivot = (key: "s3" | "s2" | "s1" | "pivot" | "r1" | "r2" | "r3", label: string, color: string): Column => ({
        key,
        label,
        value: (row) => row.pivots?.[key] ?? null,
        render: (row) => <span className={color}>{fmt(row.pivots?.[key] ?? null)}</span>,
      });
      return [
        ltp,
        pivot("s3", "S3", "text-rose-700 dark:text-rose-300"),
        pivot("s2", "S2", "text-rose-600 dark:text-rose-400"),
        pivot("s1", "S1", "text-rose-500 dark:text-rose-400"),
        pivot("pivot", "Pivot", "font-semibold text-foreground"),
        pivot("r1", "R1", "text-emerald-500 dark:text-emerald-400"),
        pivot("r2", "R2", "text-emerald-600 dark:text-emerald-400"),
        pivot("r3", "R3", "text-emerald-700 dark:text-emerald-300"),
      ];
    }
  }
}

function readUrl(): { index: string | null; tab: IndexTab | null; view: View | null } {
  if (typeof window === "undefined") return { index: null, tab: null, view: null };
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const view = params.get("view");
  return {
    index: params.get("index"),
    tab: TABS.some((item) => item.id === tab) ? (tab as IndexTab) : null,
    view: VIEWS.some((item) => item.id === view) ? (view as View) : null,
  };
}

function Snapshot({ index }: { index: IndexRow }) {
  const facts: readonly [string, React.ReactNode][] = [
    ["Open", fmt(index.open)],
    ["High", fmt(index.high)],
    ["Low", fmt(index.low)],
    ["Prev. Close", fmt(index.prevClose)],
    ["52W High", fmt(index.yearHigh)],
    ["52W Low", fmt(index.yearLow)],
    ["P/E", fmt(index.pe)],
    ["P/B", fmt(index.pb)],
    ["Div. Yield", index.dividendYield === null ? "—" : `${fmt(index.dividendYield)}%`],
    ["Adv / Dec", index.advances === null ? "—" : `${index.advances} / ${index.declines ?? 0}`],
    ["1 Week", <Signed key="w" value={index.change1w} suffix="%" />],
    ["1 Month", <Signed key="m" value={index.change1m} suffix="%" />],
    ["1 Year", <Signed key="y" value={index.change1y} suffix="%" />],
  ];
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-5 xl:grid-cols-7">
      {facts.map(([label, value]) => (
        <div key={label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xs font-bold tabular-nums text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function NSEIndicesTerminal() {
  const initial = useMemo(() => readUrl(), []);
  const [tab, setTab] = useState<IndexTab>(initial.tab ?? "key");
  const [view, setView] = useState<View>(initial.view ?? "overview");
  const [selected, setSelected] = useState<string>(initial.index ?? DEFAULT_INDEX);
  const [list, setList] = useState<IndexListResponse | null>(null);
  const [listError, setListError] = useState(false);
  const [detail, setDetail] = useState<IndexDetailResponse | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState<string>>({ key: "name", dir: "asc" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market-data/indices/nse", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<IndexListResponse>) : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        setList(body);
        setListError(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setListError(true);
      });
    const timer = window.setTimeout(() => setListVersion((value) => value + 1), LIST_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [listVersion]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/market-data/indices/nse/${encodeURIComponent(selected)}`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<IndexDetailResponse>) : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        setDetail(body);
        setDetailFor(selected);
        setDetailError(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setDetailError(true);
      });
    const timer = window.setTimeout(() => setDetailVersion((value) => value + 1), DETAIL_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selected, detailVersion]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("index", selected);
    params.set("tab", tab);
    params.set("view", view);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [selected, tab, view]);

  const choose = useCallback((name: string) => {
    setSelected(name);
    setBucket(null);
    setQuery("");
  }, []);

  const tabIndices = useMemo(() => {
    const rows = (list?.indices ?? []).filter((row) => row.tabs.includes(tab));
    if (tab !== "key") return rows;
    const order = ["NIFTY 50", "NIFTY BANK", "NIFTY MIDCAP 100", "NIFTY NEXT 50", "NIFTY 100", "NIFTY 200", "NIFTY 500", "NIFTY SMALLCAP 100", "NIFTY MIDCAP 50", "NIFTY SMALLCAP 50", "INDIA VIX", "NIFTY TOTAL MARKET"];
    return [...rows].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }, [list, tab]);

  const current = detailFor === selected ? detail : null;
  const index = current?.index ?? list?.indices.find((row) => row.name === selected) ?? null;
  const columns = useMemo(() => columnsFor(view), [view]);

  const rows = useMemo(() => {
    if (!current) return [];
    const needle = query.trim().toLowerCase();
    const filtered = current.constituents.filter((row) => {
      if (needle && !row.name.toLowerCase().includes(needle) && !row.symbol.toLowerCase().includes(needle)) return false;
      if (bucket && row.changePct !== null) {
        const pct = row.changePct;
        const inBucket =
          bucket === "lt-5" ? pct < -5 : bucket === "-5to-3" ? pct >= -5 && pct < -3 : bucket === "-3to0" ? pct >= -3 && pct < 0 : bucket === "0to3" ? pct >= 0 && pct <= 3 : bucket === "3to5" ? pct > 3 && pct <= 5 : pct > 5;
        if (!inBucket) return false;
      } else if (bucket) return false;
      return true;
    });
    if (sort.key === "name") return sortRows(filtered, (row) => row.name, sort.dir);
    const column = columns.find((item) => item.key === sort.key);
    return column ? sortRows(filtered, column.value, sort.dir) : filtered;
  }, [current, query, bucket, sort, columns]);

  const onSort = (key: string) => setSort((value) => nextSort(value, key, key === "name"));
  const maxBucket = Math.max(1, ...(current?.breadth ?? []).map((item) => item.count));

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">Indian Indices – Markets Terminal</h1>
            <p className="text-xs text-muted-foreground">
              Every NSE index, live, with all its constituents
              {list?.marketAdvances !== null && list?.marketAdvances !== undefined
                ? ` · NSE breadth: ${list.marketAdvances} advancing, ${list.marketDeclines ?? 0} declining`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${listError || list?.degraded ? "bg-orange-500" : "bg-emerald-500 animate-pulse"}`} />
              {list?.asOf ? `NSE as of ${list.asOf}` : "Loading…"}
            </span>
            <button
              type="button"
              onClick={() => {
                setListVersion((value) => value + 1);
                setDetailVersion((value) => value + 1);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`whitespace-nowrap px-3 py-2 text-xs font-semibold md:text-sm ${
                tab === item.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              {list ? <span className="ml-1 text-[10px] opacity-60">{list.indices.filter((row) => row.tabs.includes(item.id)).length}</span> : null}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-border/80 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Market Map</span>
            <span className="text-xs text-muted-foreground">
              {selected} constituents by today&apos;s change{bucket ? " · click the bar again to clear the filter" : " · click a bar to filter"}
            </span>
          </div>
          <div className="flex items-end gap-2 overflow-x-auto">
            {(current?.breadth ?? []).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setBucket(bucket === item.key ? null : item.key)}
                className={`flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-lg p-1 ${bucket === item.key ? "ring-2 ring-primary" : ""}`}
              >
                <span className="text-sm font-extrabold text-foreground">{item.count}</span>
                <div className="w-full rounded-md" style={{ height: `${Math.max(6, (item.count / maxBucket) * 72)}px`, backgroundColor: BUCKET_COLORS[item.key] }} />
                <span className="whitespace-nowrap text-[10px] text-muted-foreground">{item.label}</span>
              </button>
            ))}
            {!current ? <p className="py-6 text-xs text-muted-foreground">Loading…</p> : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-border/80 bg-card">
            <div className="border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {TABS.find((item) => item.id === tab)?.label}
            </div>
            <div className="lg:hidden p-2">
              <select
                value={selected}
                onChange={(event) => choose(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              >
                {tabIndices.map((row) => (
                  <option key={row.name} value={row.name}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <ul className="hidden max-h-[640px] overflow-y-auto lg:block">
              {listError && !list ? <li className="px-3 py-6 text-center text-xs text-error">Index board unavailable.</li> : null}
              {tabIndices.map((row) => (
                <li key={row.name}>
                  <button
                    type="button"
                    onClick={() => choose(row.name)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left hover:bg-muted ${
                      row.name === selected ? "bg-primary/10" : ""
                    }`}
                  >
                    <span className={`min-w-0 truncate text-xs ${row.name === selected ? "font-bold text-primary" : "font-semibold text-foreground"}`} title={row.name}>
                      {row.name}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[11px] font-semibold tabular-nums text-foreground">{fmt(row.last)}</span>
                      <span className={`block text-[10px] font-semibold tabular-nums ${tone(row.changePct)}`}>
                        {row.changePct === null ? "—" : `${row.changePct > 0 ? "+" : ""}${row.changePct.toFixed(2)}%`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="min-w-0 rounded-2xl border border-border/80 bg-card">
            <div className="border-b border-border p-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <h2 className="text-lg font-extrabold text-foreground">{selected}</h2>
                {index ? (
                  <>
                    <span className="text-lg font-bold tabular-nums text-foreground">{fmt(index.last)}</span>
                    <span className={`text-sm font-bold tabular-nums ${tone(index.change)}`}>
                      {index.change !== null ? `${index.change > 0 ? "▲" : index.change < 0 ? "▼" : ""} ${fmt(Math.abs(index.change))}` : ""}{" "}
                      ({index.changePct !== null ? `${index.changePct > 0 ? "+" : ""}${index.changePct.toFixed(2)}%` : "—"})
                    </span>
                    <span className="text-[11px] text-muted-foreground">{index.group.toLowerCase()}</span>
                  </>
                ) : null}
              </div>
              {index ? <Snapshot index={index} /> : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
                {VIEWS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={view === item.id}
                    onClick={() => setView(item.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === item.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="relative">
                <span className="sr-only">Search constituents</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search stock"
                  className="w-48 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
              </label>
            </div>

            {detailError && !current ? (
              <p className="px-4 py-12 text-center text-xs text-error">Could not load {selected} right now. Retrying shortly.</p>
            ) : !current ? (
              <p className="px-4 py-12 text-center text-xs text-muted-foreground">Loading {selected} constituents…</p>
            ) : current.noConstituents ? (
              <p className="px-4 py-12 text-center text-xs text-muted-foreground">
                {selected} has no published constituent list{selected === "INDIA VIX" ? " — it is a volatility index computed from NIFTY option prices." : "."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] border-collapse text-left">
                    <thead className="border-b border-border bg-muted/60">
                      <tr>
                        <SortableTh className={`${TH} sticky left-0 z-10 bg-muted`} label="Name" sortKey="name" sort={sort} onSort={onSort} />
                        {columns.map((column) => (
                          <SortableTh key={column.key} className={TH} label={column.label} sortKey={column.key} sort={sort} onSort={onSort} align="right" />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <tr key={row.symbol} className="group hover:bg-muted/50">
                          <td className="sticky left-0 z-10 bg-card px-3 py-2 group-hover:bg-muted">
                            <Link href={`/stock/${encodeURIComponent(row.symbol)}`} className="block max-w-[220px] truncate text-xs font-semibold text-foreground hover:text-primary hover:underline" title={row.name}>
                              {row.name}
                            </Link>
                            <span className="text-[10px] text-muted-foreground">
                              {row.symbol}
                              {row.industry ? ` · ${row.industry}` : ""}
                            </span>
                          </td>
                          {columns.map((column) => (
                            <td key={column.key} className={`${TD} text-right`}>
                              {column.render(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                  {rows.length} of {current.constituents.length} constituents
                  {current.unquoted.length > 0 ? ` · ${current.unquoted.length} not in today's quote feed (${current.unquoted.slice(0, 5).join(", ")}${current.unquoted.length > 5 ? "…" : ""})` : ""}
                  {" "}· Index values, P/E, P/B and breadth from NSE; constituents from NSE&apos;s published lists; stock prices from the live feed. Technical Rating
                  combines price vs the 20/50/200-day averages, the 50 vs 200-day trend, MACD and RSI(14); pivots are classic floor pivots.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
