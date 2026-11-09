"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, ExternalLink, FileText, RefreshCw, Rocket, Search } from "lucide-react";
import { PageShell } from "@/components/common/PageShell";
import { PageHeader } from "@/components/common/PageHeader";
import { SortableTh } from "@/components/super-investors/SortableTh";
import type { IpoIssue, IpoSubscription } from "@/lib/ipo/parse";
import type { IpoBoardResponse } from "@/lib/ipo/service";
import { nextSort, sortRows, type SortState } from "@/lib/super-investors/sorting";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
const REFRESH_MS = 60_000;
const PENDING_REFRESH_MS = 10_000;

type Tab = "open" | "upcoming" | "closed" | "listed" | "drafts";
type Segment = "all" | "Mainboard" | "SME";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "open", label: "Open IPO" },
  { id: "upcoming", label: "Upcoming IPO" },
  { id: "closed", label: "Closed IPO" },
  { id: "listed", label: "Listed IPO" },
  { id: "drafts", label: "Draft Issues (DRHP)" },
];

const TH = "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const TD = "whitespace-nowrap px-3 py-2.5 text-xs tabular-nums";

function day(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rupees(value: number | null, decimals = 0): string {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function crores(value: number | null): string {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: value < 100 ? 2 : 0 })} Cr`;
}

function band(issue: IpoIssue): string {
  if (issue.issuePrice !== null) return rupees(issue.issuePrice, 2);
  if (issue.priceLow === null || issue.priceHigh === null) return "—";
  return issue.priceLow === issue.priceHigh
    ? rupees(issue.priceHigh)
    : `₹${issue.priceLow.toLocaleString("en-IN")} – ${issue.priceHigh.toLocaleString("en-IN")}`;
}

function times(value: number | null): string {
  return value === null ? "—" : `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}x`;
}

function signedPct(value: number | null): React.ReactNode {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  const tone = value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground";
  return (
    <span className={`font-semibold ${tone}`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function daysUntil(iso: string | null, today: string): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

function istToday(): string {
  return new Date(Date.now() + 19_800_000).toISOString().slice(0, 10);
}

function SegmentBadge({ segment }: { segment: IpoIssue["segment"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        segment === "SME"
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
      }`}
    >
      {segment}
    </span>
  );
}

const SUBSCRIPTION_ROWS: readonly { key: keyof IpoSubscription; label: string }[] = [
  { key: "qib", label: "QIB" },
  { key: "nii", label: "NII" },
  { key: "bnii", label: "bNII (> ₹10L)" },
  { key: "snii", label: "sNII (₹2–10L)" },
  { key: "retail", label: "Retail" },
  { key: "employee", label: "Employee" },
  { key: "shareholder", label: "Shareholder" },
  { key: "total", label: "Total" },
];

function SubscriptionBars({ subscription }: { subscription: IpoSubscription | null }) {
  const rows = SUBSCRIPTION_ROWS.filter(({ key }) => subscription?.[key] !== null && subscription?.[key] !== undefined);
  if (!subscription || rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Subscription figures appear once bidding starts.</p>;
  }
  const max = Math.max(1, ...rows.map(({ key }) => subscription[key] ?? 0));
  return (
    <div className="space-y-1.5">
      {rows.map(({ key, label }) => {
        const value = subscription[key] ?? 0;
        return (
          <div key={key} className="grid grid-cols-[96px_1fr_64px] items-center gap-2 text-[11px]">
            <span className={`text-muted-foreground ${key === "total" ? "font-bold text-foreground" : ""}`}>{label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${value >= 1 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }}
              />
            </div>
            <span className={`text-right font-mono font-semibold ${key === "total" ? "text-foreground" : "text-muted-foreground"}`}>
              {times(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function Timeline({ issue }: { issue: IpoIssue }) {
  const steps: readonly [string, string | null][] = [
    ["Opens", issue.timeline.open],
    ["Closes", issue.timeline.close],
    ["Allotment", issue.timeline.allotment],
    ["Refunds", issue.timeline.refund],
    ["Demat credit", issue.timeline.dematCredit],
    ["Listing", issue.timeline.listing],
  ];
  const today = istToday();
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {steps.map(([label, date]) => {
        const done = date !== null && date <= today;
        return (
          <li key={label} className={`rounded-lg border px-2 py-1.5 ${done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xs font-semibold text-foreground">{day(date)}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Documents({ issue }: { issue: IpoIssue }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {issue.documents.map((document) => (
        <a
          key={document.url}
          href={document.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
        >
          <FileText className="h-3 w-3" aria-hidden />
          {document.label}
        </a>
      ))}
      <a
        href={issue.nseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted dark:text-indigo-300"
      >
        NSE issue page
        <ExternalLink className="h-3 w-3" aria-hidden />
      </a>
    </div>
  );
}

function IssueCard({ issue }: { issue: IpoIssue }) {
  const today = istToday();
  const left = issue.status === "open" ? daysUntil(issue.closeDate, today) : daysUntil(issue.openDate, today);
  const badge =
    issue.status === "open"
      ? left === 0
        ? "Closes today"
        : `Closes in ${left} day${left === 1 ? "" : "s"}`
      : left === null
        ? "Dates to be announced"
        : left <= 0
          ? "Opens today"
          : `Opens in ${left} day${left === 1 ? "" : "s"}`;
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-foreground">{issue.companyName}</h3>
            <SegmentBadge segment={issue.segment} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {issue.symbol}
            {issue.industry ? ` · ${issue.industry}` : ""}
            {issue.issueType ? ` · ${issue.issueType}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
            issue.status === "open" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-sky-500/15 text-sky-700 dark:text-sky-300"
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          {badge}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Price band" value={band(issue)} />
        <Fact label="Lot size" value={issue.lotSize ? `${issue.lotSize.toLocaleString("en-IN")} shares` : "—"} />
        <Fact label="Min. investment" value={rupees(issue.minInvestment)} />
        <Fact label="Issue size" value={crores(issue.issueSizeCr)} />
        <Fact label="Bidding" value={`${day(issue.openDate)} – ${day(issue.closeDate)}`} />
        <Fact label={issue.timeline.tentative ? "Listing (tentative)" : "Listing"} value={day(issue.timeline.listing)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Subscription (times, NSE + BSE)
          </p>
          <SubscriptionBars subscription={issue.subscription} />
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Timeline {issue.timeline.tentative ? "(T+3 schedule, tentative)" : ""}
            </p>
            <Timeline issue={issue} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {issue.registrar ? `Registrar: ${issue.registrar}` : ""}
            {issue.leadManagers ? ` · Lead manager: ${issue.leadManagers}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <Documents issue={issue} />
      </div>
    </article>
  );
}

type ClosedKey = "company" | "close" | "price" | "size" | "subscription" | "listing";
type ListedKey = "company" | "listing" | "price" | "size" | "subscription" | "open" | "listingGain" | "ltp" | "gain" | "day";

const closedValue = (issue: IpoIssue, key: ClosedKey): number | string | null => {
  switch (key) {
    case "company": return issue.companyName;
    case "close": return issue.closeDate;
    case "price": return issue.issuePrice ?? issue.priceHigh;
    case "size": return issue.issueSizeCr;
    case "subscription": return issue.subscription?.total ?? null;
    case "listing": return issue.timeline.listing;
  }
};

const listedValue = (issue: IpoIssue, key: ListedKey): number | string | null => {
  switch (key) {
    case "company": return issue.companyName;
    case "listing": return issue.listingDate;
    case "price": return issue.issuePrice;
    case "size": return issue.issueSizeCr;
    case "subscription": return issue.subscription?.total ?? null;
    case "open": return issue.listing?.openPrice ?? null;
    case "listingGain": return issue.listing?.listingGainPct ?? null;
    case "ltp": return issue.listing?.lastPrice ?? null;
    case "gain": return issue.listing?.currentGainPct ?? null;
    case "day": return issue.listing?.dayChangePct ?? null;
  }
};

function CompanyCell({ issue }: { issue: IpoIssue }) {
  return (
    <td className="px-3 py-2.5">
      <a href={issue.nseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:text-primary hover:underline">
        {issue.companyName}
      </a>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {issue.symbol} <SegmentBadge segment={issue.segment} />
      </div>
    </td>
  );
}

function ClosedTable({ issues }: { issues: readonly IpoIssue[] }) {
  const [sort, setSort] = useState<SortState<ClosedKey>>({ key: "close", dir: "desc" });
  const rows = useMemo(() => sortRows(issues, (issue) => closedValue(issue, sort.key), sort.dir), [issues, sort]);
  const onSort = (key: ClosedKey) => setSort((current) => nextSort(current, key, key === "company"));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead className="border-b border-border bg-muted/60">
          <tr>
            <SortableTh className={TH} label="Company" sortKey="company" sort={sort} onSort={onSort} />
            <SortableTh className={TH} label="Closed" sortKey="close" sort={sort} onSort={onSort} />
            <SortableTh className={TH} label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Issue size" sortKey="size" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Subscribed" sortKey="subscription" sort={sort} onSort={onSort} align="right" />
            <th className={`${TH} text-right`}>QIB / NII / Retail</th>
            <th className={TH}>Allotment</th>
            <th className={TH}>Refunds</th>
            <th className={TH}>Demat credit</th>
            <SortableTh className={TH} label="Listing" sortKey="listing" sort={sort} onSort={onSort} />
            <th className={TH}>Documents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((issue) => (
            <tr key={issue.symbol} className="hover:bg-muted/50">
              <CompanyCell issue={issue} />
              <td className={TD}>{day(issue.closeDate)}</td>
              <td className={`${TD} text-right`}>{band(issue)}</td>
              <td className={`${TD} text-right`}>{crores(issue.issueSizeCr)}</td>
              <td className={`${TD} text-right font-bold`}>{times(issue.subscription?.total ?? null)}</td>
              <td className={`${TD} text-right text-muted-foreground`}>
                {times(issue.subscription?.qib ?? null)} / {times(issue.subscription?.nii ?? null)} / {times(issue.subscription?.retail ?? null)}
              </td>
              <td className={TD}>{day(issue.timeline.allotment)}</td>
              <td className={TD}>{day(issue.timeline.refund)}</td>
              <td className={TD}>{day(issue.timeline.dematCredit)}</td>
              <td className={TD}>
                {day(issue.timeline.listing)}
                {issue.timeline.tentative ? <span className="ml-1 text-[10px] text-muted-foreground">(tentative)</span> : null}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex gap-1.5">
                  {issue.documents.slice(0, 2).map((document) => (
                    <a key={document.url} href={document.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-primary hover:underline dark:text-indigo-300">
                      {document.label === "Red Herring Prospectus" ? "RHP" : document.label}
                    </a>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListedTable({ issues, pending }: { issues: readonly IpoIssue[]; pending: boolean }) {
  const [sort, setSort] = useState<SortState<ListedKey>>({ key: "listing", dir: "desc" });
  const rows = useMemo(() => sortRows(issues, (issue) => listedValue(issue, sort.key), sort.dir), [issues, sort]);
  const onSort = (key: ListedKey) => setSort((current) => nextSort(current, key, key === "company"));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead className="border-b border-border bg-muted/60">
          <tr>
            <SortableTh className={TH} label="Company" sortKey="company" sort={sort} onSort={onSort} />
            <SortableTh className={TH} label="Listed on" sortKey="listing" sort={sort} onSort={onSort} />
            <SortableTh className={TH} label="Issue price" sortKey="price" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Issue size" sortKey="size" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Subscribed" sortKey="subscription" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Listing open" sortKey="open" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Listing gain" sortKey="listingGain" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="LTP" sortKey="ltp" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Gain vs issue" sortKey="gain" sort={sort} onSort={onSort} align="right" />
            <SortableTh className={TH} label="Day %" sortKey="day" sort={sort} onSort={onSort} align="right" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((issue) => (
            <tr key={issue.symbol} className="hover:bg-muted/50">
              <CompanyCell issue={issue} />
              <td className={TD}>{day(issue.listingDate)}</td>
              <td className={`${TD} text-right`}>{rupees(issue.issuePrice, 2)}</td>
              <td className={`${TD} text-right`}>{crores(issue.issueSizeCr)}</td>
              <td className={`${TD} text-right font-bold`}>{issue.subscription ? times(issue.subscription.total) : pending ? "…" : "—"}</td>
              <td className={`${TD} text-right`}>{rupees(issue.listing?.openPrice ?? null, 2)}</td>
              <td className={`${TD} text-right`}>{signedPct(issue.listing?.listingGainPct ?? null)}</td>
              <td className={`${TD} text-right font-semibold`}>{rupees(issue.listing?.lastPrice ?? null, 2)}</td>
              <td className={`${TD} text-right`}>{signedPct(issue.listing?.currentGainPct ?? null)}</td>
              <td className={`${TD} text-right`}>{signedPct(issue.listing?.dayChangePct ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DraftsTable({ drafts }: { drafts: IpoBoardResponse["drafts"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="border-b border-border bg-muted/60">
          <tr>
            <th className={TH}>Filed with SEBI</th>
            <th className={TH}>Company</th>
            <th className={TH}>Document</th>
            <th className={TH}>Link</th>
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
                  View on SEBI <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isBoard(value: unknown): value is IpoBoardResponse {
  return value !== null && typeof value === "object" && Array.isArray((value as IpoBoardResponse).listed);
}

export default function IPOPage() {
  const [data, setData] = useState<IpoBoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab | null>(null);
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const response = await fetch("/api/market-data/ipo", { cache: "no-store", signal: controller.signal });
        const body: unknown = unwrapApiEnvelope(await response.json().catch(() => null));
        if (!active) return;
        if (!response.ok || !isBoard(body)) {
          setError("IPO data is temporarily unavailable. Retrying shortly.");
          return;
        }
        setData(body);
        setError(null);
      } catch (cause) {
        if (active && !(cause instanceof Error && cause.name === "AbortError")) {
          setError("IPO data is temporarily unavailable. Retrying shortly.");
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

  const pending = data?.pending ?? false;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") setVersion((value) => value + 1);
    }, pending ? PENDING_REFRESH_MS : REFRESH_MS);
    return () => window.clearTimeout(timer);
  }, [version, pending]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  // Default to the first tab with something in it (Open when bidding is live).
  const activeTab: Tab =
    tab ??
    (data
      ? data.open.length > 0
        ? "open"
        : data.upcoming.length > 0
          ? "upcoming"
          : data.closed.length > 0
            ? "closed"
            : "listed"
      : "open");

  const filter = useCallback(
    (issues: readonly IpoIssue[]) => {
      const needle = query.trim().toLowerCase();
      return issues.filter(
        (issue) =>
          (segment === "all" || issue.segment === segment) &&
          (!needle || issue.companyName.toLowerCase().includes(needle) || issue.symbol.toLowerCase().includes(needle)),
      );
    },
    [query, segment],
  );

  const counts: Record<Tab, number> = {
    open: data?.open.length ?? 0,
    upcoming: data?.upcoming.length ?? 0,
    closed: data?.closed.length ?? 0,
    listed: data?.listed.length ?? 0,
    drafts: data?.drafts.length ?? 0,
  };

  const drafts = (data?.drafts ?? []).filter((draft) => !query.trim() || draft.company.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = data ? filter(activeTab === "drafts" ? [] : data[activeTab]) : [];

  const empty: Record<Tab, string> = {
    open: "No IPO is open for bidding right now.",
    upcoming: "No IPO has announced its dates yet.",
    closed: "No IPO closed in the last 30 days without listing.",
    listed: "No recent listings match.",
    drafts: "No draft offer documents match.",
  };

  return (
    <div className="min-h-screen bg-background">
      <PageShell className="py-6">
        <PageHeader title="IPO" description="Live IPO dashboard — open, upcoming, closed and listed issues on NSE, with subscription, timelines and listing gains" icon={Rocket}>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${error ? "bg-orange-500" : "bg-emerald-500 animate-pulse"}`} />
              {data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST` : loading ? "Loading…" : "Offline"}
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

        <div className="mb-4 flex flex-wrap gap-2" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeTab === item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold md:text-sm ${
                activeTab === item.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-[11px] opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(["all", "Mainboard", "SME"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSegment(option)}
                disabled={activeTab === "drafts"}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                  segment === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "all" ? "All IPOs" : option === "Mainboard" ? "Mainboard" : "SME"}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="sr-only">Search IPOs</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company or symbol"
              className="w-60 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs text-orange-700 dark:text-orange-300">
            {error}
            {data ? " Showing the last loaded board." : ""}
          </p>
        ) : null}
        {data && data.degraded.length > 0 ? (
          <p className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs text-orange-700 dark:text-orange-300">
            {data.degraded.join(", ")} did not respond on the last refresh; showing the last good data.
          </p>
        ) : null}

        {!data ? (
          <div className="rounded-2xl border border-border/80 bg-card px-4 py-16 text-center text-sm text-muted-foreground">
            {loading ? "Loading live IPO board…" : "No data yet."}
          </div>
        ) : activeTab === "open" || activeTab === "upcoming" ? (
          visible.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              {empty[activeTab]}
              {activeTab === "open" && data.upcoming.length > 0 ? " See Upcoming IPO for the next issues." : ""}
              {data.closed.length > 0 ? " Recently closed issues are under Closed IPO." : ""}
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((issue) => (
                <IssueCard key={issue.symbol} issue={issue} />
              ))}
            </div>
          )
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            {(activeTab === "drafts" ? drafts.length : visible.length) === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">{empty[activeTab]}</div>
            ) : activeTab === "closed" ? (
              <ClosedTable issues={visible} />
            ) : activeTab === "listed" ? (
              <ListedTable issues={visible} pending={pending} />
            ) : (
              <DraftsTable drafts={drafts} />
            )}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Sources: NSE (issue boards, issue information, consolidated NSE + BSE subscription, trading holidays), SEBI (draft offer
          documents), and the live quote feed for listed prices. Allotment, refund, demat-credit and listing dates follow SEBI&apos;s
          T+3 timeline counted in trading days and are marked tentative until NSE publishes the listing. Listing gain compares the
          listing-day open with the issue price. Not investment advice.
        </p>
      </PageShell>
    </div>
  );
}
