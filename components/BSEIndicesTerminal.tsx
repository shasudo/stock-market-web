"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Search } from "lucide-react";
import { SortableTh } from "@/components/super-investors/SortableTh";
import type { IndexTab } from "@/lib/indices/catalog";
import { BREADTH_BUCKETS, bucketOf } from "@/lib/indices/catalog";
import type { BseIndexRow, BseIndicesResponse } from "@/lib/indices/bse";
import { BSE_KEY_INDICES } from "@/lib/indices/bse";
import { nextSort, sortRows, type SortState } from "@/lib/super-investors/sorting";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
const REFRESH_MS = 30_000;
const PENDING_REFRESH_MS = 15_000;

const TABS: readonly { id: IndexTab; label: string }[] = [
  { id: "key", label: "Key Indices" },
  { id: "sectoral", label: "Sectoral Indices" },
  { id: "other", label: "Other Indices" },
  { id: "largeCap", label: "Large Cap" },
  { id: "midCap", label: "Mid Cap" },
  { id: "smallCap", label: "Small Cap" },
  { id: "all", label: "All Indices" },
];

type View = "overview" | "performance" | "range";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "range", label: "52-Week Range" },
];

const BUCKET_COLORS: Readonly<Record<string, string>> = {
  "lt-5": "#B91C1C",
  "-5to-3": "#EF4444",
  "-3to0": "#F87171",
  "0to3": "#4ADE80",
  "3to5": "#16A34A",
  gt5: "#15803D",
};

const TH = "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const TD = "whitespace-nowrap px-3 py-2 text-xs tabular-nums text-right";

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Signed({ value, suffix = "", pending = false }: { value: number | null | undefined; suffix?: string; pending?: boolean }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-muted-foreground">{pending ? "…" : "—"}</span>;
  const tone = value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground";
  return (
    <span className={`font-semibold ${tone}`}>
      {value > 0 ? "+" : ""}
      {fmt(value)}
      {suffix}
    </span>
  );
}

interface Column {
  readonly key: string;
  readonly label: string;
  readonly value: (row: BseIndexRow) => number | null;
  readonly render: (row: BseIndexRow) => React.ReactNode;
}

function columnsFor(view: View): Column[] {
  const last: Column = { key: "last", label: "Value", value: (row) => row.last, render: (row) => <span className="font-semibold text-foreground">{fmt(row.last)}</span> };
  const pct: Column = { key: "pct", label: "%Chg", value: (row) => row.changePct, render: (row) => <Signed value={row.changePct} suffix="%" /> };
  const plain = (key: string, label: string, pick: (row: BseIndexRow) => number | null): Column => ({
    key,
    label,
    value: pick,
    render: (row) => <span className="text-foreground">{row.historyLoaded || !["h52", "l52"].includes(key) ? fmt(pick(row)) : "…"}</span>,
  });
  if (view === "overview") {
    return [
      last,
      { key: "chg", label: "Chg", value: (row) => row.change, render: (row) => <Signed value={row.change} /> },
      pct,
      plain("open", "Open", (row) => row.open),
      plain("high", "High", (row) => row.high),
      plain("low", "Low", (row) => row.low),
      plain("prev", "Prev. Close", (row) => row.prevClose),
    ];
  }
  if (view === "performance") {
    return [
      last,
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
          render: (row) => <Signed value={row.performance[key]} suffix="%" pending={!row.historyLoaded} />,
        }),
      ),
    ];
  }
  return [
    last,
    plain("h52", "52W High", (row) => row.high52),
    plain("l52", "52W Low", (row) => row.low52),
    { key: "fromHigh", label: "From 52W High", value: (row) => row.fromHigh52, render: (row) => <Signed value={row.fromHigh52} suffix="%" pending={!row.historyLoaded} /> },
    { key: "fromLow", label: "From 52W Low", value: (row) => row.fromLow52, render: (row) => <Signed value={row.fromLow52} suffix="%" pending={!row.historyLoaded} /> },
  ];
}

export default function BSEIndicesTerminal() {
  const [data, setData] = useState<BseIndicesResponse | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<IndexTab>("key");
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState<string> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market-data/indices/bse", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? (response.json().then((body: unknown) => unwrapApiEnvelope(body)) as Promise<BseIndicesResponse>) : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        setData(body);
        setError(false);
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof Error && cause.name === "AbortError")) setError(true);
      });
    return () => controller.abort();
  }, [version]);

  const pending = (data?.historyPending ?? 0) > 0;
  useEffect(() => {
    const timer = window.setTimeout(() => setVersion((value) => value + 1), pending ? PENDING_REFRESH_MS : REFRESH_MS);
    return () => window.clearTimeout(timer);
  }, [version, pending]);

  const columns = useMemo(() => columnsFor(view), [view]);
  const inTab = useMemo(() => (data?.indices ?? []).filter((row) => row.tabs.includes(tab)), [data, tab]);

  const breadth = useMemo(() => {
    const counts = new Map<string, number>(BREADTH_BUCKETS.map((item) => [item.key, 0]));
    for (const row of inTab) {
      if (row.changePct === null) continue;
      const key = bucketOf(row.changePct);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return BREADTH_BUCKETS.map((item) => ({ ...item, count: counts.get(item.key) ?? 0 }));
  }, [inTab]);
  const maxBucket = Math.max(1, ...breadth.map((item) => item.count));

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = inTab.filter(
      (row) =>
        (!needle || row.name.toLowerCase().includes(needle)) &&
        (!bucket || (row.changePct !== null && bucketOf(row.changePct) === bucket)),
    );
    if (!sort) {
      if (tab !== "key") return filtered;
      return [...filtered].sort((a, b) => BSE_KEY_INDICES.indexOf(a.name) - BSE_KEY_INDICES.indexOf(b.name));
    }
    if (sort.key === "name") return sortRows(filtered, (row) => row.name, sort.dir);
    const column = columns.find((item) => item.key === sort.key);
    return column ? sortRows(filtered, column.value, sort.dir) : filtered;
  }, [inTab, query, bucket, sort, columns, tab]);

  const onSort = (key: string) => setSort((current) => nextSort(current, key, key === "name"));

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground md:text-2xl">BSE Indices – Markets Terminal</h1>
            <p className="text-xs text-muted-foreground">
              Every BSE index, live
              {data ? ` · ${data.advancing} indices up, ${data.declining} down today` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${error ? "bg-orange-500" : "bg-emerald-500 animate-pulse"}`} />
              {data?.lastSyncAt
                ? `Updated ${new Date(data.lastSyncAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST`
                : "Loading…"}
            </span>
            <button
              type="button"
              onClick={() => setVersion((value) => value + 1)}
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
              onClick={() => {
                setTab(item.id);
                setBucket(null);
              }}
              className={`whitespace-nowrap px-3 py-2 text-xs font-semibold md:text-sm ${
                tab === item.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              {data ? <span className="ml-1 text-[10px] opacity-60">{data.indices.filter((row) => row.tabs.includes(item.id)).length}</span> : null}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl border border-border/80 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Market Map</span>
            <span className="text-xs text-muted-foreground">
              {TABS.find((item) => item.id === tab)?.label} by today&apos;s change · {bucket ? "click the bar again to clear" : "click a bar to filter"}
            </span>
          </div>
          <div className="flex items-end gap-2 overflow-x-auto">
            {breadth.map((item) => (
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
          </div>
        </div>

        <section className="rounded-2xl border border-border/80 bg-card">
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
              <span className="sr-only">Search indices</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search index"
                className="w-48 rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </label>
          </div>

          {error && !data ? (
            <p className="px-4 py-12 text-center text-xs text-error">BSE index data is unavailable right now. Retrying shortly.</p>
          ) : !data ? (
            <p className="px-4 py-12 text-center text-xs text-muted-foreground">Loading BSE indices…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-xs text-muted-foreground">No index matches.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="border-b border-border bg-muted/60">
                  <tr>
                    <SortableTh className={`${TH} sticky left-0 z-10 bg-muted`} label="Index" sortKey="name" sort={sort} onSort={onSort} />
                    {columns.map((column) => (
                      <SortableTh key={column.key} className={TH} label={column.label} sortKey={column.key} sort={sort} onSort={onSort} align="right" />
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.securityId} className="group hover:bg-muted/50">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-foreground group-hover:bg-muted">{row.name}</td>
                      {columns.map((column) => (
                        <td key={column.key} className={TD}>
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            {data && data.historyPending > 0 ? `Loading daily history for ${data.historyPending} indices — 52-week and period returns fill in shortly. ` : ""}
            Values from the live BSE index feed; 52-week range and returns from each index&apos;s daily closes (YTD from the previous year&apos;s last close).
            BSE does not publish index constituents in a machine-readable form, so stock-level breakdowns are available for NSE indices only.
          </p>
        </section>
      </div>
    </div>
  );
}
