"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/common/PageShell";
import { threeColorScale } from "@/lib/market-data/heatmap-colors";
import type {
  HeatmapCell,
  HeatmapSourceSpan,
  MonthlyHeatmap,
} from "@/lib/market-data/monthly-heatmap";
import {
  fetchMonthlyHeatmap,
  getMonthlyHeatmapErrorMessage,
  isAbortError,
} from "@/lib/market-data/monthly-heatmap-client";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const HEADER_BG = "#C6E0B4";
const GRID_BORDER = "#7F7F7F";
const SHEET_FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";

export interface MonthlyHeatmapSheetProps {
  readonly title: string;
  readonly endpoint: string;
  readonly refreshIntervalMs: number;
  /** Label for the latest value in the status line, e.g. "NIFTY 50". */
  readonly latestLabel: string;
  readonly sourceNote: (heatmap: MonthlyHeatmap) => string;
}

function formatCell(kind: MonthlyHeatmap["kind"], value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return kind === "return" ? `${rounded.toFixed(1)}%` : rounded.toFixed(1);
}

function formatStat(kind: MonthlyHeatmap["kind"], value: number | null): string {
  if (value === null) return "";
  return formatCell(kind, value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthSpan(span: HeatmapSourceSpan | null): string {
  if (!span) return "";
  const label = (key: string): string =>
    `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  return `${label(span.from)} – ${label(span.to)}`;
}

function cellTitle(
  kind: MonthlyHeatmap["kind"],
  label: string,
  cell: HeatmapCell,
): string {
  const parts = [label];
  if (kind === "level") {
    parts.push(`P/E ${cell.value.toFixed(2)}`);
    if (cell.change !== null) {
      parts.push(`${cell.change >= 0 ? "+" : ""}${cell.change.toFixed(2)}% vs previous`);
    }
  } else {
    parts.push(`${cell.value >= 0 ? "+" : ""}${cell.value.toFixed(2)}%`);
  }
  parts.push(cell.partial ? "live, in progress" : cell.source === "archive" ? "archived month-end" : "month-end close");
  return parts.join(" · ");
}

function LiveDot() {
  return (
    <span
      aria-hidden
      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#1F7A3F] animate-pulse"
    />
  );
}

function SheetTable({ title, heatmap }: { title: string; heatmap: MonthlyHeatmap }) {
  const { kind, rows, stats } = heatmap;

  const totalScale = useMemo(
    () => threeColorScale(rows.map((row) => row.total?.change)),
    [rows],
  );

  const cellStyle = {
    border: `1px solid ${GRID_BORDER}`,
  } as const;

  return (
    <div className="w-full overflow-x-auto">
      <table
        className="w-full min-w-[860px] border-collapse text-center text-[13px] leading-tight text-black"
        style={{ fontFamily: SHEET_FONT }}
      >
        <thead>
          <tr>
            <th style={{ ...cellStyle, backgroundColor: HEADER_BG }} />
            <th
              colSpan={13}
              className="py-1 text-[15px] font-bold"
              style={{ ...cellStyle, backgroundColor: HEADER_BG }}
            >
              {title}
            </th>
          </tr>
          <tr>
            <th
              className="w-[7%] py-1"
              style={{ ...cellStyle, backgroundColor: HEADER_BG }}
            />
            {MONTHS.map((month) => (
              <th
                key={month}
                className="py-1 font-bold"
                style={{ ...cellStyle, backgroundColor: HEADER_BG }}
              >
                {month}
              </th>
            ))}
            <th
              className="py-1 font-bold"
              style={{ ...cellStyle, backgroundColor: HEADER_BG }}
            >
              CY
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => {
            const scale = threeColorScale(stat.months);
            return (
              <tr key={stat.label}>
                <th
                  scope="row"
                  className="px-1.5 py-1 text-left font-bold"
                  style={{ ...cellStyle, backgroundColor: HEADER_BG }}
                >
                  {stat.label}
                </th>
                {stat.months.map((value, index) => (
                  <td
                    key={MONTHS[index]}
                    className="px-1 py-1 tabular-nums"
                    style={{ ...cellStyle, backgroundColor: scale(value) ?? "#FFFFFF" }}
                  >
                    {formatStat(kind, value)}
                  </td>
                ))}
                <td
                  className="px-1 py-1 font-bold tabular-nums"
                  style={{ ...cellStyle, backgroundColor: "#FFFFFF" }}
                >
                  {formatStat(kind, stat.total)}
                </td>
              </tr>
            );
          })}
          {rows.map((row) => {
            const scale = threeColorScale(row.months.map((cell) => cell?.change));
            return (
              <tr key={row.year}>
                <th
                  scope="row"
                  className="px-1.5 py-1 text-left font-bold"
                  style={{ ...cellStyle, backgroundColor: HEADER_BG }}
                >
                  {row.year}
                </th>
                {row.months.map((cell, index) => (
                  <td
                    key={MONTHS[index]}
                    className="relative px-1 py-1 tabular-nums"
                    style={{
                      ...cellStyle,
                      backgroundColor: cell ? scale(cell.change) ?? "#FFFFFF" : "#FFFFFF",
                    }}
                    title={cell ? cellTitle(kind, `${MONTHS[index]} ${row.year}`, cell) : undefined}
                  >
                    {cell ? formatCell(kind, cell.value) : ""}
                    {cell?.partial ? <LiveDot /> : null}
                  </td>
                ))}
                <td
                  className="relative px-1 py-1 font-bold tabular-nums"
                  style={{
                    ...cellStyle,
                    backgroundColor: row.total
                      ? totalScale(row.total.change) ?? "#FFFFFF"
                      : "#FFFFFF",
                  }}
                  title={
                    row.total
                      ? cellTitle(
                          kind,
                          kind === "return" ? `${row.year} calendar year` : `${row.year} year-end`,
                          row.total,
                        )
                      : undefined
                  }
                >
                  {row.total ? formatCell(kind, row.total.value) : ""}
                  {row.total?.partial && rows[0] === row ? <LiveDot /> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MonthlyHeatmapSheet({
  title,
  endpoint,
  refreshIntervalMs,
  latestLabel,
  sourceNote,
}: MonthlyHeatmapSheetProps) {
  const [heatmap, setHeatmap] = useState<MonthlyHeatmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const load = async (): Promise<void> => {
      try {
        const next = await fetchMonthlyHeatmap(endpoint, controller.signal);
        if (!isCurrent) return;
        setHeatmap(next);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent || isAbortError(error)) return;
        setErrorMessage(getMonthlyHeatmapErrorMessage(error));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [endpoint, refreshVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setRefreshVersion((version) => version + 1);
      }
    }, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [refreshIntervalMs]);

  const latestText =
    heatmap?.latestValue != null
      ? heatmap.kind === "return"
        ? heatmap.latestValue.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : heatmap.latestValue.toFixed(2)
      : null;

  return (
    <div className="min-h-screen bg-background">
      <PageShell className="py-6">
        <div
          className="rounded-lg border border-border bg-white p-4 text-black shadow-sm sm:p-6"
          style={{ fontFamily: SHEET_FONT }}
        >
          <div className="mb-5 flex justify-center">
            <h1
              className="rounded-sm border-[3px] border-[#7F9F97] px-6 py-1.5 text-center text-3xl font-bold tracking-tight text-[#8EA596] sm:px-12 sm:text-5xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {title}
            </h1>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#404040]">
            <div className="flex items-center gap-2">
              {heatmap && !errorMessage ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#63BE7B] opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1F7A3F]" />
                  </span>
                  <span className="font-semibold">Live</span>
                </>
              ) : (
                <>
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#A6A6A6]" />
                  <span className="font-semibold">
                    {isLoading ? "Connecting…" : heatmap ? "Reconnecting…" : "Offline"}
                  </span>
                </>
              )}
              {latestText ? (
                <span>
                  {latestLabel} <span className="font-bold tabular-nums">{latestText}</span>
                  {heatmap?.asOf ? ` · as of ${formatDate(heatmap.asOf)}` : ""}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-[#595959]">
              Updates every {Math.round(refreshIntervalMs / 60_000)} min · hover a cell for detail
            </span>
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="mb-3 rounded-md border border-[#F8696B] bg-[#FDE2E2] px-4 py-2 text-sm text-[#9C0006]"
            >
              {errorMessage}
              {heatmap ? " Showing the last loaded data." : ""}
            </p>
          ) : null}

          {heatmap && heatmap.rows.length > 0 ? (
            <SheetTable title={title} heatmap={heatmap} />
          ) : (
            <div
              className="py-16 text-center text-sm text-[#595959]"
              style={{ border: `1px solid ${GRID_BORDER}` }}
            >
              {isLoading ? "Loading live data…" : errorMessage ? "No data to show." : "No data collected yet."}
            </div>
          )}

          {heatmap ? (
            <p className="mt-3 text-xs text-[#595959]">{sourceNote(heatmap)}</p>
          ) : null}

          <div className="mt-4 rounded-sm border-2 border-[#9FB3AD] px-4 py-3 text-sm leading-relaxed text-black">
            <span className="font-bold">Disclaimer:</span> This is not investment
            advice or a recommendation to buy or sell any security. Past
            performance of the NIFTY 50 does not guarantee future results. All
            investments carry risk; consult a qualified advisor before investing.
            No liability is accepted for decisions based on this information.
          </div>
        </div>
      </PageShell>
    </div>
  );
}

export default MonthlyHeatmapSheet;
