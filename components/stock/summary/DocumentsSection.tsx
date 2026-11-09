"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import apiClient, { isSuccessfulApiResponse } from "@/lib/api-client";
import type {
  CompanyDocumentsResponse,
  ConcallItem,
  CorporateActionKind,
  FilingItem,
} from "@/lib/company-documents/documents";

const ACTIONS_PREVIEW = 8;

const KIND_STYLES: Readonly<Record<CorporateActionKind, { label: string; className: string }>> = {
  dividend: { label: "Dividend", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  bonus: { label: "Bonus", className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  split: { label: "Split", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  rights: { label: "Rights", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  buyback: { label: "Buyback", className: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" },
  demerger: { label: "Demerger", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  other: { label: "Other", className: "bg-muted text-muted-foreground" },
};

function formatDay(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: value.length === 10 ? "UTC" : "Asia/Kolkata",
  });
}

function formatMonth(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-indigo-300"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

function Column({
  title,
  count,
  empty,
  unavailable,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  unavailable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-background/50">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-xs font-extrabold text-foreground">{title}</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="max-h-80 overflow-y-auto px-3">
        {unavailable ? (
          <p className="py-6 text-center text-[11px] text-error">Unavailable from NSE right now.</p>
        ) : count === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y divide-border">{children}</ul>
        )}
      </div>
    </div>
  );
}

function FilingRow({ item, showCategory }: { item: FilingItem; showCategory: boolean }) {
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatDay(item.date)}</span>
        {item.fileSize ? <span className="text-[10px] text-muted-foreground">{item.fileSize}</span> : null}
      </div>
      {showCategory ? (
        <p className="mt-0.5 text-xs font-semibold text-foreground">
          {item.url ? <DocLink href={item.url}>{item.category}</DocLink> : item.category}
        </p>
      ) : null}
      {item.summary ? (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground" title={item.summary}>
          {!showCategory && item.url ? <DocLink href={item.url}>{item.summary}</DocLink> : item.summary}
        </p>
      ) : !showCategory && item.url ? (
        <DocLink href={item.url}>View document</DocLink>
      ) : null}
    </li>
  );
}

function ConcallRow({ item }: { item: ConcallItem }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2.5">
      <span className="text-xs font-semibold text-foreground">{formatMonth(item.date)}</span>
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={item.summary}
          className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted"
        >
          {item.label}
        </a>
      ) : null}
    </li>
  );
}

export function DocumentsSection({ symbol }: { symbol: string }) {
  const [state, setState] = useState<{
    symbol: string;
    data: CompanyDocumentsResponse | null;
    failed: boolean;
  }>({ symbol, data: null, failed: false });
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const showAllActions = expandedFor === symbol;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const response = await apiClient.get<unknown>(
          `/api/stocks/${encodeURIComponent(symbol)}/documents`,
          { signal: controller.signal, timeout: 45_000 },
        );
        const data = isSuccessfulApiResponse(response.data)
          ? (response.data.data as CompanyDocumentsResponse | null)
          : null;
        if (!active) return;
        const valid = data !== null && Array.isArray(data.actions) && Array.isArray(data.announcements);
        setState({ symbol, data: valid ? data : null, failed: !valid });
      } catch {
        if (active && !controller.signal.aborted) setState({ symbol, data: null, failed: true });
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol]);

  const data = state.symbol === symbol ? state.data : null;
  const failed = state.symbol === symbol && state.failed;
  const unavailable = new Set(data?.unavailable ?? []);
  const actions = data
    ? showAllActions
      ? data.actions
      : data.actions.slice(0, ACTIONS_PREVIEW)
    : [];

  return (
    <section
      id="documents"
      className="scroll-mt-24 rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold text-foreground">Corporate Actions & Documents</h2>
        {data ? (
          <span className="text-[11px] text-muted-foreground">Source: NSE filings · updated {formatDay(data.fetchedAt)}</span>
        ) : null}
      </div>

      {failed ? (
        <p className="py-4 text-center text-xs text-error">Could not load corporate actions and documents right now.</p>
      ) : !data ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Loading corporate actions and documents…</p>
      ) : (
        <>
          <h3 className="mb-2 text-xs font-extrabold text-foreground">Corporate Actions</h3>
          {unavailable.has("actions") ? (
            <p className="py-3 text-center text-xs text-error">Corporate actions are unavailable from NSE right now.</p>
          ) : data.actions.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              NSE lists no corporate actions for {symbol}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">Ex-date</th>
                    <th className="px-3 py-2 text-left font-semibold">Record date</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action, index) => {
                    const style = KIND_STYLES[action.kind];
                    return (
                      <tr key={`${action.exDate}-${action.subject}-${index}`} className="border-b border-border hover:bg-muted">
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">{formatDay(action.exDate)}</td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{formatDay(action.recordDate)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.className}`}>{style.label}</span>
                        </td>
                        <td className="px-3 py-2 text-foreground">{action.subject}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.actions.length > ACTIONS_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setExpandedFor(showAllActions ? null : symbol)}
                  className="mt-2 text-xs font-semibold text-primary hover:underline dark:text-indigo-300"
                >
                  {showAllActions ? "Show fewer" : `Show all ${data.actions.length}`}
                </button>
              ) : null}
            </div>
          )}

          <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-extrabold text-foreground">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Documents
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Column
              title="Announcements"
              count={data.announcements.length}
              empty="No announcements in the last year."
              unavailable={unavailable.has("announcements")}
            >
              {data.announcements.map((item, index) => (
                <FilingRow key={`${item.date}-${index}`} item={item} showCategory />
              ))}
            </Column>
            <Column
              title="Annual Reports"
              count={data.annualReports.length}
              empty="No annual reports filed with NSE."
              unavailable={unavailable.has("annualReports")}
            >
              {data.annualReports.map((report) => (
                <li key={report.url} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <DocLink href={report.url}>Financial Year {report.toYear}</DocLink>
                  <span className="text-[10px] text-muted-foreground">
                    {report.url.toLowerCase().endsWith(".zip") ? "ZIP" : "PDF"}
                  </span>
                </li>
              ))}
            </Column>
            <Column
              title="Credit Ratings"
              count={data.creditRatings.length}
              empty="No credit-rating updates in the last year."
              unavailable={unavailable.has("announcements")}
            >
              {data.creditRatings.map((item, index) => (
                <FilingRow key={`${item.date}-${index}`} item={item} showCategory={false} />
              ))}
            </Column>
            <Column
              title="Concalls"
              count={data.concalls.length}
              empty="No analyst or con-call documents in the last year."
              unavailable={unavailable.has("announcements")}
            >
              {data.concalls.map((item, index) => (
                <ConcallRow key={`${item.date}-${index}`} item={item} />
              ))}
            </Column>
          </div>
        </>
      )}
    </section>
  );
}
