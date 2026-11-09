"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { SortableTh } from "@/components/super-investors/SortableTh";
import { partners, preferredPartner, unlistedSharesFAQs } from "@/lib/unlisted-shares-data";
import type { IpoBoardResponse } from "@/lib/ipo/service";
import type { UnlistedDetail, UnlistedSummary } from "@/lib/unlisted/types";
import { nextSort, sortRows, type SortState } from "@/lib/super-investors/sorting";

const REFRESH_MS = 5 * 60_000;
const TH = "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const TD = "whitespace-nowrap px-3 py-2.5 text-xs tabular-nums";

type PriceKey = "name" | "sector" | "price" | "change" | "changePct" | "high52" | "low52" | "updated";
type Pipeline = "drafts" | "upcoming";

interface UnlistedListResponse {
  readonly companies: readonly UnlistedSummary[];
  readonly feed: { readonly configured: boolean; readonly name: string | null; readonly lastSyncAt: string | null };
  readonly generatedAt: string;
}

function day(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "Asia/Kolkata",
  });
}

function rupees(value: number | null): string {
  return value === null ? "—" : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function Signed({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const tone = value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground";
  return (
    <span className={`font-semibold ${tone}`}>
      {value > 0 ? "+" : ""}
      {value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      {suffix}
    </span>
  );
}

function priceValue(row: UnlistedSummary, key: PriceKey): number | string | null {
  switch (key) {
    case "name": return row.name;
    case "sector": return row.sector || null;
    case "price": return row.price;
    case "change": return row.change;
    case "changePct": return row.changePct;
    case "high52": return row.high52;
    case "low52": return row.low52;
    case "updated": return row.updatedAt;
  }
}

/** Price history line for one company (only real recorded quotes). */
function HistoryChart({ history }: { history: UnlistedDetail["history"] }) {
  if (history.length < 2) {
    return <p className="text-xs text-muted-foreground">The chart appears once there are two or more recorded quotes.</p>;
  }
  const width = 560;
  const height = 160;
  const prices = history.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const x = (index: number) => 8 + (index / (history.length - 1)) * (width - 16);
  const y = (price: number) => 8 + (1 - (price - min) / span) * (height - 16);
  const path = history.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.price)}`).join(" ");
  const up = prices.at(-1)! >= prices[0]!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Price history">
      <path d={path} fill="none" stroke={up ? "#10B981" : "#F43F5E"} strokeWidth={2} strokeLinejoin="round" />
      {history.map((point, index) => (
        <circle key={`${point.asOf}-${index}`} cx={x(index)} cy={y(point.price)} r={2.5} fill={up ? "#10B981" : "#F43F5E"}>
          <title>{`${day(point.asOf)}: ${rupees(point.price)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function CompanyDetail({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [company, setCompany] = useState<UnlistedDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/market-data/unlisted-shares/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body: { company: UnlistedDetail }) => setCompany(body.company))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setFailed(true);
      });
    return () => controller.abort();
  }, [slug]);
  return (
    <tr>
      <td colSpan={9} className="bg-muted/30 px-4 py-4">
        {failed ? (
          <p className="text-xs text-error">Could not load this company right now.</p>
        ) : !company ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <HistoryChart history={company.history} />
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {company.description ? <p className="text-foreground">{company.description}</p> : null}
              {company.isin ? <p>ISIN: <span className="font-mono text-foreground">{company.isin}</span></p> : null}
              {company.faceValue ? <p>Face value: {rupees(company.faceValue)}</p> : null}
              {company.minLotShares ? <p>Minimum lot: {company.minLotShares.toLocaleString("en-IN")} shares</p> : null}
              <p>{company.quoteCount} recorded quote{company.quoteCount === 1 ? "" : "s"}</p>
              {company.website ? (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-indigo-300">
                  Company website <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
              <button type="button" onClick={onClose} className="block pt-1 font-semibold text-foreground hover:underline">
                Close
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function PriceTable({ companies }: { companies: readonly UnlistedSummary[] }) {
  const [sort, setSort] = useState<SortState<PriceKey>>({ key: "name", dir: "asc" });
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => sortRows(companies, (row) => priceValue(row, sort.key), sort.dir), [companies, sort]);
  const onSort = (key: PriceKey) => setSort((current) => nextSort(current, key, key === "name" || key === "sector"));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left">
        <thead className="border-b border-border bg-muted/60">
          <tr>
            <SortableTh className={TH} label="Company" sortKey="name" sort={sort} onSort={onSort} />
            <SortableTh className={TH} label="Sector" sortKey="sector" sort={sort} onSort={onSort} />
            <SortableTh className={TH} label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Change" sortKey="change" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Change %" sortKey="changePct" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="52W High" sortKey="high52" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="52W Low" sortKey="low52" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Updated" sortKey="updated" sort={sort} onSort={onSort} />
            <th className={TH}>Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.flatMap((row) => [
            <tr key={row.id} onClick={() => setOpen(open === row.slug ? null : row.slug)} className="cursor-pointer hover:bg-muted/50">
              <td className="px-3 py-2.5">
                <span className="font-semibold text-foreground">{row.name}</span>
                {row.symbol ? <span className="ml-1.5 text-[10px] text-muted-foreground">{row.symbol}</span> : null}
              </td>
              <td className={`${TD} text-muted-foreground`}>{row.sector || "—"}</td>
              <td className={`${TD} text-right font-bold text-foreground`}>{rupees(row.price)}</td>
              <td className={`${TD} text-right`}><Signed value={row.change} /></td>
              <td className={`${TD} text-right`}><Signed value={row.changePct === null ? null : Math.round(row.changePct * 100) / 100} suffix="%" /></td>
              <td className={`${TD} text-right`}>{rupees(row.high52)}</td>
              <td className={`${TD} text-right`}>{rupees(row.low52)}</td>
              <td className={`${TD} text-muted-foreground`}>{day(row.updatedAt)}</td>
              <td className={`${TD} text-muted-foreground`}>{row.source ?? "—"}</td>
            </tr>,
            open === row.slug ? <CompanyDetail key={`${row.id}-detail`} slug={row.slug} onClose={() => setOpen(null)} /> : null,
          ])}
        </tbody>
      </table>
    </div>
  );
}

export default function UnlistedSharesPage() {
  const [prices, setPrices] = useState<UnlistedListResponse | null>(null);
  const [board, setBoard] = useState<IpoBoardResponse | null>(null);
  const [failed, setFailed] = useState<{ prices: boolean; board: boolean }>({ prices: false, board: false });
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [pipeline, setPipeline] = useState<Pipeline>("drafts");
  const [query, setQuery] = useState("");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>("1");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      const [priceResult, boardResult] = await Promise.allSettled([
        fetch("/api/market-data/unlisted-shares", { cache: "no-store", signal: controller.signal }).then((response) =>
          response.ok ? (response.json() as Promise<UnlistedListResponse>) : Promise.reject(new Error(String(response.status))),
        ),
        fetch("/api/market-data/ipo", { cache: "no-store", signal: controller.signal }).then((response) =>
          response.ok ? (response.json() as Promise<IpoBoardResponse>) : Promise.reject(new Error(String(response.status))),
        ),
      ]);
      if (!active) return;
      if (priceResult.status === "fulfilled") setPrices(priceResult.value);
      if (boardResult.status === "fulfilled") setBoard(boardResult.value);
      setFailed({ prices: priceResult.status === "rejected", board: boardResult.status === "rejected" });
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [version]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setVersion((value) => value + 1);
    }, REFRESH_MS);
    return () => window.clearTimeout(timer);
  }, [version]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const needle = query.trim().toLowerCase();
  const priced = (prices?.companies ?? []).filter(
    (row) => row.price !== null && (!needle || row.name.toLowerCase().includes(needle) || (row.symbol ?? "").toLowerCase().includes(needle)),
  );
  const drafts = (board?.drafts ?? []).filter((draft) => !needle || draft.company.toLowerCase().includes(needle));
  const upcoming = [...(board?.upcoming ?? []), ...(board?.open ?? [])].filter(
    (issue) => !needle || issue.companyName.toLowerCase().includes(needle),
  );

  return (
    <div className="min-h-screen bg-background">
      <PageShell className="py-6">
        <PageHeader title="Unlisted Shares" description="Pre-IPO companies: indicative dealer prices and the live pipeline of companies heading to the exchanges" icon={Building}>
          <div className="flex items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search companies</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search company"
                className="w-52 rounded-full border border-border bg-card py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </label>
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

        <section className="mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-extrabold text-foreground">Unlisted share prices</h2>
            <span className="text-[11px] text-muted-foreground">
              Indicative dealer quotes · click a row for its price history
            </span>
          </div>
          {failed.prices && !prices ? (
            <p className="px-4 py-10 text-center text-xs text-error">Prices are temporarily unavailable.</p>
          ) : !prices ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">Loading prices…</p>
          ) : priced.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              {needle ? "No priced company matches your search." : "Dealer price quotes will appear here as they are published."}
            </p>
          ) : (
            <PriceTable companies={priced} />
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-extrabold text-foreground">Pre-IPO pipeline</h2>
              <p className="text-[11px] text-muted-foreground">Unlisted companies moving to listing — live from SEBI and NSE</p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              {([
                ["drafts", `Filed with SEBI (${drafts.length})`],
                ["upcoming", `IPO dates set (${upcoming.length})`],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPipeline(id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${pipeline === id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {failed.board && !board ? (
            <p className="px-4 py-10 text-center text-xs text-error">The pipeline is temporarily unavailable.</p>
          ) : !board ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">Loading pipeline…</p>
          ) : pipeline === "drafts" ? (
            drafts.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">No draft offer documents match.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead className="border-b border-border bg-muted/60">
                    <tr>
                      <th className={TH}>Filed</th>
                      <th className={TH}>Company</th>
                      <th className={TH}>Document</th>
                      <th className={TH}>SEBI filing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {drafts.map((draft) => (
                      <tr key={draft.url} className="hover:bg-muted/50">
                        <td className={TD}>{day(draft.date)}</td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-foreground">{draft.company}</td>
                        <td className={TD}>{draft.documentType}</td>
                        <td className="px-3 py-2.5">
                          <a href={draft.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline dark:text-indigo-300">
                            View <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : upcoming.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              No IPO currently has bidding dates set. See the IPO page for recently closed and listed issues.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="border-b border-border bg-muted/60">
                  <tr>
                    <th className={TH}>Company</th>
                    <th className={TH}>Segment</th>
                    <th className={TH}>Bidding</th>
                    <th className={`${TH} text-right`}>Price band</th>
                    <th className={`${TH} text-right`}>Issue size</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcoming.map((issue) => (
                    <tr key={issue.symbol} className="hover:bg-muted/50">
                      <td className="px-3 py-2.5">
                        <a href={issue.nseUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:text-primary hover:underline">
                          {issue.companyName}
                        </a>
                      </td>
                      <td className={TD}>{issue.segment}</td>
                      <td className={TD}>{day(issue.openDate)} – {day(issue.closeDate)}</td>
                      <td className={`${TD} text-right`}>
                        {issue.priceLow !== null && issue.priceHigh !== null ? `₹${issue.priceLow} – ${issue.priceHigh}` : "—"}
                      </td>
                      <td className={`${TD} text-right`}>{issue.issueSizeCr !== null ? `₹${issue.issueSizeCr.toFixed(issue.issueSizeCr < 100 ? 2 : 0)} Cr` : "—"}</td>
                      <td className={TD}>{issue.status === "open" ? "Open now" : "Upcoming"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-border/90 bg-card p-5 shadow-xs">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Preferred Liquidity Partner</h3>
              <div className="flex w-fit items-center gap-3 rounded-xl border border-border bg-muted p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white shadow-xs">IC</div>
                <div>
                  <span className="block text-sm font-bold text-foreground">{preferredPartner.name}</span>
                  <span className="text-[10px] text-muted-foreground">Institutional Custody &amp; Escrow</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/90 bg-card p-5 shadow-xs">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Secondary Market Partners</h3>
              <div className="flex flex-wrap gap-3">
                {partners.map((partner) => (
                  <div key={partner.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-muted-foreground">
                      {partner.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-foreground">{partner.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border/90 bg-card p-5 shadow-xs">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-foreground">Unlisted FAQ</h3>
              <div className="space-y-2">
                {unlistedSharesFAQs.map((faq) => (
                  <div key={faq.id} className="overflow-hidden rounded-xl border border-border/90">
                    <button
                      onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                      className="flex w-full items-center justify-between bg-muted/50 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="text-xs font-bold text-foreground">{faq.question}</span>
                      {expandedFAQ === faq.id ? (
                        <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {expandedFAQ === faq.id ? (
                      <div className="border-t border-border p-3.5 text-xs leading-relaxed text-muted-foreground">{faq.answer}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Unlisted shares do not trade on an exchange; prices are indicative dealer quotes and can differ between dealers. The
          pipeline comes from SEBI&apos;s draft offer document filings and NSE&apos;s issue boards. Not investment advice.
        </p>
      </PageShell>
    </div>
  );
}
