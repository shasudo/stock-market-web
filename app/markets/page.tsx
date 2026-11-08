"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { int } from "@/lib/format";
import type {
  BseIndexResponse,
  IndexListResponse,
  IpoItem,
  IpoResponse,
  LiveMarketResponse,
} from "@/lib/types";
import { usePoll } from "@/hooks/usePoll";
import { ChangePill, DataStamp, Num } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { cn } from "@/lib/cn";

type View = "stocks" | "indices" | "ipo";
type Exchange = "NSE" | "BSE";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "stocks", label: "Stocks" },
  { id: "indices", label: "Indices" },
  { id: "ipo", label: "IPO" },
];

/** Markets: one screener, one indices terminal, one IPO board. State lives in the URL. */
export default function MarketsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-muted">Loading markets…</div>}>
      <MarketsInner />
    </Suspense>
  );
}

function MarketsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rawView = params.get("view") ?? "stocks";
  const view: View = rawView === "indices" || rawView === "ipo" ? rawView : "stocks";
  const rawEx = params.get("exchange") ?? "NSE";
  const exchange: Exchange = rawEx === "BSE" ? "BSE" : "NSE";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const tab = params.get("tab") ?? "all";

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.replace(qs === "" ? "/markets" : `/markets?${qs}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div role="tablist" aria-label="Market views" className="flex gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => set({ view: v.id, page: null, tab: null })}
            className={cn(
              "min-h-[36px] border-b-2 px-3 text-[13px] font-semibold",
              view === v.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "stocks" && (
        <StocksView
          exchange={exchange}
          page={page}
          onExchange={(e) => set({ exchange: e, page: null })}
          onPage={(p) => set({ page: String(p) })}
        />
      )}
      {view === "indices" && (
        <IndicesView
          exchange={exchange}
          tab={tab}
          onExchange={(e) => set({ exchange: e })}
          onTab={(t) => set({ tab: t === "all" ? null : t })}
        />
      )}
      {view === "ipo" && <IpoView />}
    </div>
  );
}

function ExchangeToggle({ value, onChange }: { value: Exchange; onChange: (e: Exchange) => void }) {
  return (
    <div role="group" aria-label="Exchange" className="flex rounded-md border border-line p-0.5">
      {(["NSE", "BSE"] as Exchange[]).map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onChange(ex)}
          aria-pressed={value === ex}
          className={cn(
            "min-h-[32px] rounded-sm px-3 text-[13px] font-medium",
            value === ex ? "bg-accent/10 text-accent" : "text-muted hover:text-fg",
          )}
        >
          {ex}
        </button>
      ))}
    </div>
  );
}

function StaleBadge() {
  return (
    <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
      STALE — showing last good data
    </span>
  );
}

function StocksView({
  exchange,
  page,
  onExchange,
  onPage,
}: {
  exchange: Exchange;
  page: number;
  onExchange: (e: Exchange) => void;
  onPage: (p: number) => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data, stale, failed } = usePoll(
    () => apiGet<LiveMarketResponse>(`/market/live?exchange=${exchange}&page=${page}&pageSize=50`),
    15_000,
  );

  const q = query.trim().toLowerCase();
  const stocks = (data?.stocks ?? []).filter(
    (s) => q === "" || s.companyName.toLowerCase().includes(q) || s.tradingSymbol.toLowerCase().includes(q),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="market-search">
          Search stocks
        </label>
        <input
          id="market-search"
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — / focuses here"
          className="h-9 w-64 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <ExchangeToggle value={exchange} onChange={onExchange} />
        {stale && <StaleBadge />}
        {data?.stats != null && (
          <span className="tnum ml-auto text-xs text-muted">
            ▲{data.stats.totalGainers} ▼{data.stats.totalLosers} — {data.stats.totalUnchanged} flat
          </span>
        )}
      </div>

      <section aria-label="Stocks" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "company",
              header: "Company",
              render: (s) => (
                <Link href={`/stock/${s.tradingSymbol}`} className="font-medium hover:text-accent">
                  {s.companyName}
                  <span className="tnum ml-2 text-[11px] font-normal text-faint">{s.tradingSymbol}</span>
                </Link>
              ),
            },
            {
              key: "ltp",
              header: "LTP",
              align: "right",
              render: (s) => <span className="tnum tnum-strong">{s.cmp == null ? "—" : s.cmp}</span>,
            },
            {
              key: "chg",
              header: "Chg",
              align: "right",
              render: (s) => <Num value={s.netChange} />,
            },
            {
              key: "pct",
              header: "%",
              align: "right",
              render: (s) => <ChangePill value={s.percentChange} />,
            },
            {
              key: "vol",
              header: "Vol",
              align: "right",
              render: (s) => <span className="tnum text-muted">{int(s.volume)}</span>,
            },
            {
              key: "w52h",
              header: "52W H",
              align: "right",
              render: (s) => <span className="tnum text-muted">{s.week52High == null ? "—" : int(s.week52High)}</span>,
            },
            {
              key: "w52l",
              header: "52W L",
              align: "right",
              render: (s) => <span className="tnum text-muted">{s.week52Low == null ? "—" : int(s.week52Low)}</span>,
            },
            {
              key: "cap",
              header: "Mkt cap",
              align: "right",
              render: (s) => <span className="tnum text-muted">{s.marketCap ?? "—"}</span>,
            },
          ]}
          rows={stocks}
          rowKey={(s) => s.tradingSymbol}
          loading={data == null && !failed}
          empty={
            <EmptyState
              title="No stocks match — clear search or wait for the next sync."
              action={
                q !== "" ? (
                  <button type="button" onClick={() => setQuery("")} className="text-sm font-medium text-accent">
                    Clear search
                  </button>
                ) : undefined
              }
            />
          }
        />
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <div className="tnum text-xs text-muted">
            Page {data?.pagination.page ?? page} of {data?.pagination.totalPages ?? "—"} ·{" "}
            {data?.pagination.totalStocks ?? 0} stocks
          </div>
          <DataStamp label={data?.lastSyncAt} className="border-0 px-0 py-0" />
        </div>
        <div className="flex gap-2 border-t border-line px-4 py-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(Math.max(1, page - 1))}
            className="min-h-[36px] rounded-md border border-line px-3 text-sm font-medium disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={data != null && page >= data.pagination.totalPages}
            onClick={() => onPage(page + 1)}
            className="min-h-[36px] rounded-md border border-line px-3 text-sm font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </>
  );
}

function IndicesView({
  exchange,
  tab,
  onExchange,
  onTab,
}: {
  exchange: Exchange;
  tab: string;
  onExchange: (e: Exchange) => void;
  onTab: (t: string) => void;
}) {
  const { data, stale, failed } = usePoll(
    () =>
      apiGet<IndexListResponse | BseIndexResponse>(
        exchange === "NSE" ? "/market-data/indices/nse" : "/market-data/indices/bse",
      ),
    30_000,
  );

  const nse = exchange === "NSE" ? (data as IndexListResponse | null) : null;
  const bse = exchange === "BSE" ? (data as BseIndexResponse | null) : null;

  const tabs =
    nse == null
      ? []
      : Array.from(new Set(nse.indices.flatMap((r) => r.tabs))).filter((t) => t !== "all").sort();
  const rows = (nse?.indices ?? []).filter((r) => r.last != null && (tab === "all" || r.tabs.includes(tab)));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ExchangeToggle value={exchange} onChange={onExchange} />
        {exchange === "NSE" && tabs.length > 0 && (
          <div role="group" aria-label="Index group" className="flex flex-wrap gap-1">
            {["all", ...tabs].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTab(t)}
                aria-pressed={tab === t}
                className={cn(
                  "min-h-[32px] rounded-full border px-3 text-xs font-medium capitalize",
                  tab === t ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-fg",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {stale && <StaleBadge />}
        {bse != null && (
          <span className="tnum ml-auto text-xs text-muted">
            ▲{bse.advancing ?? "—"} ▼{bse.declining ?? "—"}
          </span>
        )}
      </div>

      <section aria-label="Indices" className="overflow-hidden rounded-md border border-line bg-surface">
        {exchange === "NSE" ? (
          <DataTable
            stickyFirst
            columns={[
              {
                key: "name",
                header: "Index",
                render: (r) => <span className="font-medium">{r.name}</span>,
              },
              {
                key: "last",
                header: "Last",
                align: "right",
                render: (r) => (
                  <span className="tnum tnum-strong">
                    {r.last?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                ),
              },
              {
                key: "chg",
                header: "Chg",
                align: "right",
                render: (r) => <Num value={r.change} />,
              },
              {
                key: "pct",
                header: "%",
                align: "right",
                render: (r) => <ChangePill value={r.changePct} />,
              },
              {
                key: "high52",
                header: "52W H",
                align: "right",
                render: (r) => (
                  <span className="tnum text-muted">
                    {r.yearHigh?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
              {
                key: "low52",
                header: "52W L",
                align: "right",
                render: (r) => (
                  <span className="tnum text-muted">
                    {r.yearLow?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.name}
            loading={nse == null && !failed}
            empty={<EmptyState title="No index data yet — quotes fill in after the next sync." />}
          />
        ) : (
          <DataTable
            stickyFirst
            columns={[
              {
                key: "name",
                header: "Index",
                render: (r) => <span className="font-medium">{r.name}</span>,
              },
              {
                key: "last",
                header: "Last",
                align: "right",
                render: (r) => (
                  <span className="tnum tnum-strong">
                    {r.last?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
                  </span>
                ),
              },
              {
                key: "chg",
                header: "Chg",
                align: "right",
                render: (r) => <Num value={r.change} />,
              },
              {
                key: "pct",
                header: "%",
                align: "right",
                render: (r) => <ChangePill value={r.changePct} />,
              },
              {
                key: "high52",
                header: "52W H",
                align: "right",
                render: (r) => (
                  <span className="tnum text-muted">
                    {r.high52?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
              {
                key: "low52",
                header: "52W L",
                align: "right",
                render: (r) => (
                  <span className="tnum text-muted">
                    {r.low52?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                  </span>
                ),
              },
            ]}
            rows={bse?.indices ?? []}
            rowKey={(r) => r.name}
            loading={bse == null && !failed}
            empty={<EmptyState title="No BSE index data yet — quotes fill in after the next sync." />}
          />
        )}
        <DataStamp
          label={
            (nse != null && (nse.generatedAt ?? nse.asOf)) || (bse != null && (bse.generatedAt ?? bse.lastSyncAt)) || null
          }
        />
      </section>
    </>
  );
}

function IpoView() {
  const { data, stale, failed } = usePoll(() => apiGet<IpoResponse>("/market-data/ipo"), 300_000);

  const listed = [...(data?.listed ?? [])].sort((a, b) => (b.listingDate ?? "").localeCompare(a.listingDate ?? ""));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {stale && <StaleBadge />}
        {data != null && (
          <p className="tnum text-xs text-muted">
            {data.open.length} open · {data.upcoming.length} upcoming · {data.closed.length} closed ·{" "}
            {data.listed.length} listed
            {data.pending ? " · full calendar pending" : ""}
          </p>
        )}
      </div>

      <section aria-label="IPOs" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "company",
              header: "Company",
              render: (r: IpoItem) => (
                <span>
                  <span className="font-medium">{r.companyName}</span>
                  {r.segment != null && (
                    <span className="tnum ml-2 text-[11px] font-normal text-faint">{r.segment}</span>
                  )}
                </span>
              ),
            },
            {
              key: "listed",
              header: "Listed",
              align: "right",
              render: (r: IpoItem) => <span className="tnum text-muted">{r.listingDate ?? "—"}</span>,
            },
            {
              key: "band",
              header: "Band",
              align: "right",
              render: (r: IpoItem) => (
                <span className="tnum text-muted">
                  {r.priceLow == null ? "—" : `${r.priceLow}–${r.priceHigh ?? "—"}`}
                </span>
              ),
            },
            {
              key: "issue",
              header: "Issue",
              align: "right",
              render: (r: IpoItem) => <span className="tnum">{r.issuePrice ?? "—"}</span>,
            },
            {
              key: "size",
              header: "Size (Cr)",
              align: "right",
              render: (r: IpoItem) => (
                <span className="tnum text-muted">
                  {r.issueSizeCr?.toLocaleString("en-IN", { maximumFractionDigits: 0 }) ?? "—"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r: IpoItem) => <span className="text-xs capitalize text-muted">{r.status ?? "—"}</span>,
            },
          ]}
          rows={listed}
          rowKey={(r) => `${r.companyName}-${r.listingDate ?? r.symbol ?? ""}`}
          loading={data == null && !failed}
          empty={
            <EmptyState
              title={
                data?.pending
                  ? "IPO calendar is still being built — listed issues appear here first."
                  : "No listed issues in this window."
              }
            />
          }
        />
        <DataStamp label={data?.generatedAt} />
      </section>
    </>
  );
}
