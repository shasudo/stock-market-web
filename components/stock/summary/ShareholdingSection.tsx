"use client";

import { Fragment, useEffect, useState } from "react";
import apiClient, { isSuccessfulApiResponse } from "@/lib/api-client";
import type {
  ShareholdingHolderLine,
  ShareholdingPatternResponse,
  ShareholdingQuarter,
} from "@/lib/shareholding-pattern/types";

type CategoryKey = "promoters" | "fiis" | "diis" | "government" | "public" | "others";

const CATEGORIES: readonly { key: CategoryKey; label: string; color: string }[] = [
  { key: "promoters", label: "Promoters", color: "#6366F1" },
  { key: "fiis", label: "FIIs", color: "#0EA5E9" },
  { key: "diis", label: "DIIs", color: "#10B981" },
  { key: "government", label: "Government", color: "#F59E0B" },
  { key: "public", label: "Public", color: "#F43F5E" },
  { key: "others", label: "Others", color: "#94A3B8" },
];

function quarterLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function isQuarter(value: unknown): value is ShareholdingQuarter {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as ShareholdingQuarter).asOfDate === "string"
  );
}

function LatestSplit({ quarter }: { quarter: ShareholdingQuarter }) {
  const parts = CATEGORIES.map((category) => ({
    ...category,
    value: quarter[category.key] ?? 0,
  })).filter((part) => part.value > 0);
  return (
    <div className="mb-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Latest shareholding split">
        {parts.map((part) => (
          <div
            key={part.key}
            style={{ width: `${part.value}%`, backgroundColor: part.color }}
            title={`${part.label} ${part.value.toFixed(2)}%`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((part) => (
          <span key={part.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: part.color }} />
            {part.label}
            <span className="font-semibold tabular-nums text-foreground">{part.value.toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

type View = "quarterly" | "yearly";
const QUARTERLY_COLUMNS = 12;
const EXPANDABLE: ReadonlySet<CategoryKey> = new Set(["promoters", "fiis", "diis", "public"]);

function isHolderLine(value: unknown): value is ShareholdingHolderLine {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as ShareholdingHolderLine).name === "string" &&
    typeof (value as ShareholdingHolderLine).values === "object"
  );
}

/** Quarterly: the latest 12 quarters. Yearly: each March (financial year end). */
export function columnsFor(
  quarters: readonly ShareholdingQuarter[],
  view: View,
): readonly ShareholdingQuarter[] {
  return view === "quarterly"
    ? quarters.slice(-QUARTERLY_COLUMNS)
    : quarters.filter((quarter) => quarter.asOfDate.slice(5, 7) === "03");
}

function ExpandButton({
  open,
  label,
  count,
  onClick,
}: {
  open: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title={`${open ? "Hide" : "Show"} ${count} named holder${count === 1 ? "" : "s"} under ${label}`}
      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline dark:text-indigo-300"
    >
      {label}
      <span aria-hidden className="text-sm leading-none">{open ? "−" : "+"}</span>
    </button>
  );
}

export function ShareholdingSection({ symbol }: { symbol: string }) {
  const [state, setState] = useState<{
    symbol: string;
    quarters: readonly ShareholdingQuarter[] | null;
    holders: readonly ShareholdingHolderLine[];
    failed: boolean;
  }>({ symbol, quarters: null, holders: [], failed: false });
  const [view, setView] = useState<View>("quarterly");
  const [expanded, setExpanded] = useState<{ symbol: string; keys: ReadonlySet<CategoryKey> }>({
    symbol,
    keys: new Set(),
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const response = await apiClient.get<unknown>(
          `/api/stocks/${encodeURIComponent(symbol)}/shareholding`,
          { signal: controller.signal, timeout: 60_000 },
        );
        const data = isSuccessfulApiResponse(response.data)
          ? (response.data.data as ShareholdingPatternResponse | null)
          : null;
        if (!active) return;
        const quarters = Array.isArray(data?.quarters) ? data.quarters.filter(isQuarter) : null;
        const holders = Array.isArray(data?.holders) ? data.holders.filter(isHolderLine) : [];
        setState({ symbol, quarters, holders, failed: quarters === null });
      } catch {
        if (active && !controller.signal.aborted) {
          setState({ symbol, quarters: null, holders: [], failed: true });
        }
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [symbol]);

  const quarters = state.symbol === symbol ? state.quarters : null;
  const holders = state.symbol === symbol ? state.holders : [];
  const failed = state.symbol === symbol && state.failed;
  const openKeys = expanded.symbol === symbol ? expanded.keys : new Set<CategoryKey>();
  const latest = quarters?.at(-1) ?? null;
  const columns = quarters ? columnsFor(quarters, view) : [];
  const rows = CATEGORIES.filter(
    (category) =>
      category.key !== "others" ||
      columns.some((quarter) => (quarter.others ?? 0) > 0),
  );
  const holdersFor = (key: CategoryKey): ShareholdingHolderLine[] =>
    EXPANDABLE.has(key)
      ? holders.filter(
          (line) =>
            line.category === key &&
            columns.some((quarter) => (line.values[quarter.asOfDate] ?? 0) >= 0.005),
        )
      : [];
  const toggle = (key: CategoryKey): void => {
    setExpanded((current) => {
      const next = new Set(current.symbol === symbol ? current.keys : []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { symbol, keys: next };
    });
  };

  return (
    <section
      id="investors"
      className="scroll-mt-24 rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-foreground">Shareholding Pattern</h2>
          {latest ? (
            <p className="text-[11px] text-muted-foreground">
              Numbers in percentages · latest as on {quarterLabel(latest.asOfDate)}
            </p>
          ) : null}
        </div>
        {quarters && quarters.length > 0 ? (
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="tablist">
            {(["quarterly", "yearly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={`rounded-md px-3 py-1 text-[11px] font-semibold capitalize ${
                  view === option
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {failed ? (
        <p className="py-4 text-center text-xs text-error">
          Could not load the shareholding pattern right now.
        </p>
      ) : quarters === null ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Loading shareholding pattern… the first view of a company reads its exchange filings and can take a few seconds.
        </p>
      ) : quarters.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No quarterly shareholding-pattern filings found for {symbol}.
        </p>
      ) : (
        <>
          {latest ? <LatestSplit quarter={latest} /> : null}
          {columns.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No March (year-end) filing in the stored history yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold text-muted-foreground" />
                    {columns.map((quarter) => (
                      <th
                        key={quarter.asOfDate}
                        className="whitespace-nowrap px-3 py-2 text-right font-semibold text-muted-foreground"
                      >
                        {quarterLabel(quarter.asOfDate)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((category) => {
                    const lines = holdersFor(category.key);
                    const open = openKeys.has(category.key) && lines.length > 0;
                    return (
                      <Fragment key={category.key}>
                        <tr className="border-b border-border hover:bg-muted">
                          <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                              {lines.length > 0 ? (
                                <ExpandButton
                                  open={open}
                                  label={category.label}
                                  count={lines.length}
                                  onClick={() => toggle(category.key)}
                                />
                              ) : (
                                category.label
                              )}
                            </span>
                          </td>
                          {columns.map((quarter, index) => {
                            const value = quarter[category.key];
                            const previous = index > 0 ? columns[index - 1]![category.key] : null;
                            const delta = value !== null && previous !== null ? value - previous : null;
                            return (
                              <td
                                key={quarter.asOfDate}
                                className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground ${open ? "font-semibold" : ""}`}
                                title={
                                  delta === null
                                    ? undefined
                                    : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pts vs previous column`
                                }
                              >
                                {pct(value)}
                              </td>
                            );
                          })}
                        </tr>
                        {open
                          ? lines.map((line) => (
                              <tr key={`${category.key}-${line.key}`} className="border-b border-border/60 bg-muted/30 hover:bg-muted">
                                <td className="sticky left-0 z-10 w-[240px] min-w-[240px] bg-card px-3 py-1.5 pl-8 text-[11px] leading-snug text-muted-foreground">
                                  {line.name}
                                </td>
                                {columns.map((quarter) => {
                                  const value = line.values[quarter.asOfDate];
                                  return (
                                    <td
                                      key={quarter.asOfDate}
                                      className="whitespace-nowrap px-3 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground"
                                    >
                                      {value === undefined ? "" : value.toFixed(2)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          : null}
                      </Fragment>
                    );
                  })}
                  <tr className="border-b border-border hover:bg-muted">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-muted-foreground">
                      No. of Shareholders
                    </td>
                    {columns.map((quarter) => (
                      <td
                        key={quarter.asOfDate}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground"
                      >
                        {quarter.shareholders === null ? "—" : quarter.shareholders.toLocaleString("en-IN")}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            From the company&apos;s shareholding-pattern filings with the exchange (SEBI LODR Reg. 31); percentages
            as filed. Click + to list holders: every promoter-group entity, and public holders above the 1% disclosure
            threshold. A blank cell means the holder was not listed that quarter.
          </p>
        </>
      )}
    </section>
  );
}
