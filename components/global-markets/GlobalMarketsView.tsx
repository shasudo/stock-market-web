"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Globe2, RefreshCw, Search } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import type { GlobalSectionId } from "@/lib/global-markets/catalog";
import type { Performance, TechnicalRating } from "@/lib/global-markets/compute";
import type {
  GlobalMarketRow,
  GlobalMarketsResponse,
} from "@/lib/global-markets/service";

const REFRESH_MS = 60_000;
const PENDING_REFRESH_MS = 8_000;

type View = "overview" | "technical" | "performance" | "pivots";

const VIEWS: readonly { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "technical", label: "Technical" },
  { id: "performance", label: "Performance" },
  { id: "pivots", label: "Pivot Level" },
];

interface Column {
  readonly key: string;
  readonly label: string;
  readonly value: (row: GlobalMarketRow) => number | string | null;
  readonly render: (row: GlobalMarketRow) => React.ReactNode;
}

const PERFORMANCE_KEYS: readonly { key: keyof Performance; label: string }[] = [
  { key: "ytd", label: "YTD (%)" },
  { key: "w1", label: "1 Week (%)" },
  { key: "m1", label: "1 Month (%)" },
  { key: "m3", label: "3 Months (%)" },
  { key: "m6", label: "6 Months (%)" },
  { key: "y1", label: "1 Year (%)" },
  { key: "y2", label: "2 Years (%)" },
  { key: "y3", label: "3 Years (%)" },
  { key: "y5", label: "5 Years (%)" },
];

const RATING_ORDER: Readonly<Record<TechnicalRating, number>> = {
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

function flag(country: string | null): string {
  if (!country || !/^[A-Z]{2}$/.test(country)) return "🌐";
  return String.fromCodePoint(...[...country].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

function fmt(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function signedClass(value: number | null): string {
  if (value === null || value === 0) return "text-foreground";
  return value > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
}

function Signed({ value, decimals, suffix = "" }: { value: number | null; decimals: number; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`font-semibold ${signedClass(value)}`}>
      {value > 0 ? "+" : ""}
      {fmt(value, decimals)}
      {suffix}
    </span>
  );
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const time = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  return `${day} | ${time} IST`;
}

function Rating({ rating, pending }: { rating: TechnicalRating | null; pending: boolean }) {
  if (!rating) {
    return <span className="text-muted-foreground">{pending ? "…" : "—"}</span>;
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${RATING_STYLE[rating]}`}>
      {rating}
    </span>
  );
}

function columnsFor(view: View, section: GlobalSectionId, pending: boolean): Column[] {
  const price: Column = {
    key: "price",
    label: section === "bonds" ? "Yield (%)" : "LTP",
    value: (row) => row.price,
    render: (row) => <span className="font-semibold text-foreground">{fmt(row.price, row.decimals)}</span>,
  };
  const changePct: Column = {
    key: "changePct",
    label: "Chg%",
    value: (row) => row.changePct,
    render: (row) => <Signed value={row.changePct} decimals={2} />,
  };
  const plain = (key: string, label: string, pick: (row: GlobalMarketRow) => number | null): Column => ({
    key,
    label,
    value: pick,
    render: (row) => <span className="text-foreground">{fmt(pick(row), row.decimals)}</span>,
  });
  const rating: Column = {
    key: "rating",
    label: "Technical Rating",
    value: (row) => (row.technical?.rating ? RATING_ORDER[row.technical.rating] : null),
    render: (row) => <Rating rating={row.technical?.rating ?? null} pending={pending} />,
  };

  if (view === "overview") {
    return [
      price,
      {
        key: "change",
        label: "Change",
        value: (row) => row.change,
        render: (row) => <Signed value={row.change} decimals={row.decimals} />,
      },
      changePct,
      plain("high", "High", (row) => row.high),
      plain("low", "Low", (row) => row.low),
      plain("open", "Open", (row) => row.open),
      plain("prevClose", "Prev. Close", (row) => row.prevClose),
      plain("high52", "52 W High", (row) => row.high52),
      plain("low52", "52 W Low", (row) => row.low52),
      {
        key: "ytd",
        label: "YTD (%)",
        value: (row) => row.performance.ytd,
        render: (row) => <Signed value={row.performance.ytd} decimals={2} />,
      },
      rating,
    ];
  }
  if (view === "performance") {
    return [
      price,
      ...PERFORMANCE_KEYS.map(
        ({ key, label }): Column => ({
          key,
          label,
          value: (row) => row.performance[key],
          render: (row) => <Signed value={row.performance[key]} decimals={2} />,
        }),
      ),
    ];
  }
  if (view === "technical") {
    const tech = (key: "sma20" | "sma50" | "sma200" | "macd" | "macdSignal", label: string, decimals?: number): Column => ({
      key,
      label,
      value: (row) => row.technical?.[key] ?? null,
      render: (row) => <span className="text-foreground">{fmt(row.technical?.[key] ?? null, decimals ?? row.decimals)}</span>,
    });
    return [
      price,
      changePct,
      tech("sma20", "SMA 20"),
      tech("sma50", "SMA 50"),
      tech("sma200", "SMA 200"),
      {
        key: "rsi",
        label: "RSI (14)",
        value: (row) => row.technical?.rsi14 ?? null,
        render: (row) => {
          const value = row.technical?.rsi14 ?? null;
          const tone = value === null ? "" : value >= 70 ? "text-rose-600 dark:text-rose-400" : value <= 30 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
          return <span className={`font-semibold ${tone}`}>{fmt(value, 1)}</span>;
        },
      },
      tech("macd", "MACD"),
      tech("macdSignal", "MACD Signal"),
      rating,
    ];
  }
  const pivot = (key: "s3" | "s2" | "s1" | "pivot" | "r1" | "r2" | "r3", label: string, tone: string): Column => ({
    key,
    label,
    value: (row) => row.pivots?.[key] ?? null,
    render: (row) => <span className={tone}>{fmt(row.pivots?.[key] ?? null, row.decimals)}</span>,
  });
  return [
    price,
    pivot("s3", "S3", "text-rose-700 dark:text-rose-300"),
    pivot("s2", "S2", "text-rose-600 dark:text-rose-400"),
    pivot("s1", "S1", "text-rose-500 dark:text-rose-400"),
    pivot("pivot", "Pivot", "font-semibold text-foreground"),
    pivot("r1", "R1", "text-emerald-500 dark:text-emerald-400"),
    pivot("r2", "R2", "text-emerald-600 dark:text-emerald-400"),
    pivot("r3", "R3", "text-emerald-700 dark:text-emerald-300"),
  ];
}

function isResponse(value: unknown): value is GlobalMarketsResponse {
  return value !== null && typeof value === "object" && Array.isArray((value as GlobalMarketsResponse).sections);
}

export default function GlobalMarketsView() {
  const [data, setData] = useState<GlobalMarketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [section, setSection] = useState<GlobalSectionId>("indices");
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const response = await fetch("/api/market-data/global-markets", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || !isResponse(body)) {
          setError("Global market data is temporarily unavailable. Retrying shortly.");
          return;
        }
        setData(body);
        setError(null);
      } catch (cause) {
        if (active && !(cause instanceof Error && cause.name === "AbortError")) {
          setError("Global market data is temporarily unavailable. Retrying shortly.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [version]);

  const pending = data?.historyPending ?? false;
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        if (document.visibilityState === "visible") setVersion((value) => value + 1);
      },
      pending ? PENDING_REFRESH_MS : REFRESH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [version, pending]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  const current = data?.sections.find((item) => item.id === section) ?? null;
  const columns = useMemo(() => columnsFor(view, section, pending), [view, section, pending]);

  const groups = useMemo(() => {
    if (!current) return [];
    const needle = query.trim().toLowerCase();
    const column = sort ? columns.find((item) => item.key === sort.key) : undefined;
    return current.groups
      .map((group) => {
        let rows = needle
          ? group.rows.filter((row) => row.name.toLowerCase().includes(needle) || row.symbol.toLowerCase().includes(needle))
          : [...group.rows];
        if (sort && (column || sort.key === "name")) {
          rows = rows.sort((a, b) => {
            const left = sort.key === "name" ? a.name : column!.value(a);
            const right = sort.key === "name" ? b.name : column!.value(b);
            if (left === null) return 1;
            if (right === null) return -1;
            const order = typeof left === "string" ? left.localeCompare(String(right)) : left - (right as number);
            return sort.dir === "asc" ? order : -order;
          });
        }
        return { ...group, rows };
      })
      .filter((group) => group.rows.length > 0);
  }, [current, query, sort, columns]);

  const toggleSort = (key: string): void => {
    setSort((previous) =>
      previous?.key === key
        ? previous.dir === "desc"
          ? { key, dir: "asc" }
          : null
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  };

  const sortIcon = (key: string) =>
    sort?.key === key ? (
      sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
    ) : null;

  return (
    <div className="min-h-screen bg-background">
      <PageShell className="py-6">
        <PageHeader
          title="Global Markets"
          description="World indices, commodities, currencies, bond yields, Indian ADRs and US stocks — live"
          icon={Globe2}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${error ? "bg-orange-500" : "bg-emerald-500 animate-pulse"}`} />
              {data ? `Updated ${formatStamp(data.generatedAt)}` : loading ? "Loading…" : "Offline"}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </PageHeader>

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Market">
          {(data?.sections ?? []).map((item) => {
            const count = item.groups.reduce((sum, group) => sum + group.rows.length, 0);
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSection(item.id);
                  setSort(null);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors md:text-sm ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
                <span className={`ml-1.5 text-[11px] font-semibold ${active ? "opacity-80" : "opacity-60"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/80 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist" aria-label="View">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={view === item.id}
                  onClick={() => {
                    setView(item.id);
                    setSort(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    view === item.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or symbol"
                className="w-56 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="border-b border-border bg-orange-500/10 px-4 py-2 text-xs text-orange-700 dark:text-orange-300">
              {error}
              {data ? " Showing the last loaded prices." : ""}
            </p>
          ) : null}
          {data && data.degraded.length > 0 ? (
            <p className="border-b border-border bg-orange-500/10 px-4 py-2 text-xs text-orange-700 dark:text-orange-300">
              {data.degraded.join(", ")} did not respond on the last refresh; those rows show their last known values.
            </p>
          ) : null}

          {!data ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              {loading ? "Loading live global markets…" : "No data yet."}
            </div>
          ) : groups.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-20 min-w-[220px] bg-muted px-4 py-2.5 text-left font-semibold">
                      <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 uppercase">
                        Name {sortIcon("name")}
                      </button>
                    </th>
                    {columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                        >
                          {column.label} {sortIcon(column.key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <Fragment key={group.id}>
                      {current && current.groups.length > 1 ? (
                        <tr className="border-b border-border bg-muted/40">
                          <td
                            colSpan={columns.length + 1}
                            className="sticky left-0 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-foreground"
                          >
                            {group.label}
                          </td>
                        </tr>
                      ) : null}
                      {group.rows.map((row) => (
                        <tr key={row.id} className="group border-b border-border hover:bg-muted/50">
                          <td className="sticky left-0 z-10 bg-card px-4 py-2 group-hover:bg-muted">
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 text-base leading-none" aria-hidden>
                                {flag(row.country)}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="whitespace-nowrap font-semibold text-foreground">{row.name}</span>
                                  {row.marketState === "open" ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Market open" />
                                  ) : null}
                                </div>
                                <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
                                  {formatStamp(row.updatedAt)}
                                </div>
                              </div>
                            </div>
                          </td>
                          {columns.map((column) => (
                            <td key={column.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                              {column.render(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            Sources: Yahoo Finance (indices, commodities, currencies, ADRs, US stocks), CNBC (government bond yields),
            Dhan (MCX futures). Exchange data may be delayed up to 15–20 minutes; times are when each instrument last
            traded, in IST. A green dot means its market is open now. Prices refresh every minute.
          </p>
          <p>
            Performance compares today&apos;s price with the close on or before each date (YTD from the previous year&apos;s
            last close). Technical Rating combines price vs the 20/50/200-day averages, the 50 vs 200-day trend, MACD
            vs its signal and RSI(14); pivots are classic floor pivots from the previous session. Indicative only — not
            investment advice.
          </p>
        </div>
      </PageShell>
    </div>
  );
}
