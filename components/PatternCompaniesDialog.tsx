"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMarketApiErrorMessage,
  isPatternCompaniesResponse,
  type PatternCompanyMatch,
} from "@/lib/market/client-contract";

import { unwrapApiEnvelope } from "@/lib/api-envelope";
interface PatternCompaniesDialogProps {
  readonly groupId: string;
  readonly itemId: string;
  /** Human label, e.g. "Hammer". */
  readonly title: string;
  readonly timeframeIds: readonly string[];
  readonly timeframeLabels: Readonly<Record<string, string>>;
  readonly exchange: "NSE" | "BSE" | "BOTH";
  readonly onClose: () => void;
}

type Status =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "ready";
      readonly matches: readonly PatternCompanyMatch[];
      readonly matchCount: number;
      readonly scanned: number;
      readonly truncated: boolean;
      readonly skippedTimeframes: readonly string[];
      readonly evaluatedLabels: readonly string[];
    }
  | { readonly kind: "unsupported"; readonly message: string };

function formatLtp(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function PatternCompaniesDialog({
  groupId,
  itemId,
  title,
  timeframeIds,
  timeframeLabels,
  exchange,
  onClose,
}: PatternCompaniesDialogProps) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load(): Promise<void> {
      try {
        setStatus({ kind: "loading" });
        const response = await fetch("/api/market/pattern-companies", {
          method: "POST",
          credentials: "same-origin",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId,
            itemId,
            timeframeIds,
            exchange,
          }),
        });
        const payload: unknown = unwrapApiEnvelope(await response.json().catch(() => undefined));
        if (!response.ok || !isPatternCompaniesResponse(payload)) {
          throw new Error(
            getMarketApiErrorMessage(
              payload,
              "Matching companies could not be loaded.",
            ),
          );
        }
        if (controller.signal.aborted) return;
        if (!payload.supported) {
          setStatus({
            kind: "unsupported",
            message:
              payload.message ?? "This pattern is not supported for screening.",
          });
          return;
        }
        setStatus({
          kind: "ready",
          matches: payload.matches,
          matchCount: payload.matchCount,
          scanned: payload.scanned,
          truncated: payload.truncated,
          skippedTimeframes: payload.skippedTimeframes,
          evaluatedLabels: payload.evaluatedTimeframes.map(
            (id) => timeframeLabels[id] ?? id,
          ),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Matching companies could not be loaded.",
        });
      }
    }
    void load();
    return () => controller.abort();
  }, [groupId, itemId, timeframeIds, timeframeLabels, exchange]);

  const visible = useMemo(() => {
    if (status.kind !== "ready") return [];
    const query = search.trim().toLowerCase();
    const rows = [...status.matches].sort((a, b) => b.pctChange - a.pctChange);
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.companyName.toLowerCase().includes(query) ||
        row.tradingSymbol.toLowerCase().includes(query),
    );
  }, [status, search]);

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {title} — matching companies
          </DialogTitle>
          <DialogDescription>
            {status.kind === "ready"
              ? `${status.matchCount} of ${status.scanned.toLocaleString("en-IN")} scanned companies are forming this pattern (${status.evaluatedLabels.join(", ")})${status.truncated ? ` — showing first ${status.matches.length}` : ""}`
              : `Every listed company currently forming ${title}.`}
          </DialogDescription>
        </DialogHeader>

        {status.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Screening listed companies…
          </div>
        )}

        {status.kind === "error" && (
          <div className="py-8 text-center">
            <p className="text-sm text-error dark:text-rose-400">
              {status.message}
            </p>
            <button
              type="button"
              onClick={() => onClose()}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Close
            </button>
          </div>
        )}

        {status.kind === "unsupported" && (
          <div className="py-8 text-center">
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {status.message}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
              Add the pattern as a table column to see the same note per
              company.
            </p>
          </div>
        )}

        {status.kind === "ready" && (
          <>
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company…"
                className="w-full rounded border border-border py-1.5 pr-7 pl-8 text-xs focus:border-ring dark:focus:border-zinc-400 focus:outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {status.skippedTimeframes.length > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-300">
                Intraday timeframes need per-symbol data and were skipped:{" "}
                {status.skippedTimeframes
                  .map((id) => timeframeLabels[id] ?? id)
                  .join(", ")}
                .
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border">
              {visible.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  {status.matchCount === 0
                    ? `No listed company is currently forming ${title}.`
                    : "No matching companies found"}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-left text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2 text-right">LTP</th>
                      <th className="px-3 py-2 text-right">% Chg</th>
                      <th className="px-3 py-2 text-right">Volume</th>
                      <th className="px-3 py-2">Timeframe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((row) => (
                      <tr
                        key={`${row.exchange}:${row.securityId}`}
                        className="hover:bg-muted"
                      >
                        <td className="max-w-52 truncate px-3 py-1.5 font-medium text-foreground">
                          {row.companyName}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                          {row.tradingSymbol}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                          {formatLtp(row.lastPrice)}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-semibold tabular-nums ${
                            row.pctChange >= 0
                              ? "text-success dark:text-emerald-300"
                              : "text-error dark:text-rose-300"
                          }`}
                        >
                          {row.pctChange >= 0 ? "+" : ""}
                          {row.pctChange.toFixed(2)}%
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {Math.round(row.volume).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">
                          {row.matchedTimeframes
                            .map((id) => timeframeLabels[id] ?? id)
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
