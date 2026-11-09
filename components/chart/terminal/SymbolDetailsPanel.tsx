"use client";

import { useMemo } from "react";
import { computePerformance, computeSeasonality } from "@/lib/chart/analytics";
import type { ChartDataDTO } from "@/lib/market/chart-data-client";
import type { ChartCandle } from "@/lib/market/chart-candles";
import type { StockInfo } from "./useSymbolInfo";
import { DOWN_COLOR, UP_COLOR, formatNumber, signed } from "./ui";
import { formatEventDate, useSymbolEvents } from "./NewsPanel";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface SymbolDetailsPanelProps {
  readonly symbol: string;
  readonly meta: Omit<ChartDataDTO, "candles"> | null;
  readonly daily: readonly ChartCandle[];
  readonly dailyLoading: boolean;
  readonly info: StockInfo | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Compact Indian money: trillions, crores, then lakhs. */
export function formatMarketCap(value: number): string {
  const grouped = (scaled: number): string =>
    scaled.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const abs = Math.abs(value);
  if (abs >= 1e12) return `₹${grouped(value / 1e12)}T`;
  if (abs >= 1e7) return `₹${grouped(value / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${grouped(value / 1e5)} L`;
  return `₹${formatNumber(value, 0)}`;
}

export default function SymbolDetailsPanel({
  symbol,
  meta,
  daily,
  dailyLoading,
  info,
}: SymbolDetailsPanelProps) {
  const performance = useMemo(() => computePerformance(daily), [daily]);
  const seasonality = useMemo(() => computeSeasonality(daily), [daily]);
  const { events } = useSymbolEvents(symbol);
  const latestEvent = events[0];
  const quote = meta?.quote;
  const up = (quote?.netChange ?? 0) >= 0;
  const currentMonth = new Date().getMonth();
  const maxReturn = Math.max(
    1,
    ...seasonality.map((entry) => Math.abs(entry.averageReturn ?? 0)),
  );

  return (
    <section
      aria-label="Symbol details"
      className="min-h-0 flex-1 overflow-y-auto border-t-4 border-border px-4 py-3"
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-bold text-foreground">{symbol}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {meta?.exchange ?? "—"}
        </span>
      </div>
      <p className="truncate text-[12.5px] text-muted-foreground">
        {meta?.displayName ?? ""}
        {info?.sector && info.sector !== "-" ? ` · ${info.sector}` : ""}
      </p>

      {quote && (
        <>
          <p className="mt-3 flex items-baseline gap-1.5 font-mono">
            <span className="text-[30px] font-semibold leading-none text-foreground">
              {formatNumber(quote.lastPrice)}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {meta?.exchange === "INDEX" ? "POINT" : "INR"}
            </span>
          </p>
          <p
            className="mt-1 font-mono text-[14px] font-semibold"
            style={{ color: up ? UP_COLOR : DOWN_COLOR }}
          >
            {signed(quote.netChange)} {signed(quote.pctChange)}%
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${
                meta?.delayed
                  ? "bg-warning"
                  : meta?.marketOpen
                    ? "animate-pulse bg-success"
                    : "bg-muted-foreground"
              }`}
            />
            {meta?.delayed
              ? "Delayed"
              : meta?.marketOpen
                ? "Market open"
                : "Market closed"}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Last update {formatUpdated(quote.syncedAt)} IST
          </p>

          {latestEvent && (
            <div className="mt-3 rounded-lg bg-muted px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                News · {formatEventDate(latestEvent.date)}
              </p>
              <p className="pt-0.5 text-[12.5px] font-semibold leading-snug text-foreground">
                {latestEvent.title}
              </p>
              {events.length > 1 && (
                <p className="pt-0.5 text-[12px] text-muted-foreground">
                  +{events.length - 1} more event
                  {events.length - 1 === 1 ? "" : "s"} in the News tab
                </p>
              )}
            </div>
          )}

          <h3 className="mb-1 mt-5 text-[13px] font-bold text-foreground">
            Key stats
          </h3>
          <div className="divide-y divide-border">
            <Stat
              label="Previous close"
              value={formatNumber(quote.prevClose)}
            />
            <Stat
              label="Open"
              value={quote.open ? formatNumber(quote.open) : "—"}
            />
            <Stat
              label="Day range"
              value={
                quote.low && quote.high
                  ? `${formatNumber(quote.low)} – ${formatNumber(quote.high)}`
                  : "—"
              }
            />
            {info?.week52Low && info.week52High ? (
              <Stat
                label="52-week range"
                value={`${formatNumber(info.week52Low)} – ${formatNumber(info.week52High)}`}
              />
            ) : null}
            {quote.volume ? (
              <Stat label="Volume" value={formatNumber(quote.volume, 0)} />
            ) : null}
            {info?.industry && info.industry !== "-" ? (
              <Stat label="Industry" value={info.industry} />
            ) : null}
            {info?.marketCap ? (
              <Stat
                label="Market cap"
                value={formatMarketCap(info.marketCap)}
              />
            ) : null}
            {info?.trailingPe ? (
              <Stat label="P/E (TTM)" value={formatNumber(info.trailingPe)} />
            ) : null}
            {info?.eps ? (
              <Stat label="EPS (TTM)" value={formatNumber(info.eps)} />
            ) : null}
            {info?.dividendYield ? (
              <Stat
                label="Dividend yield"
                value={`${formatNumber(info.dividendYield)}%`}
              />
            ) : null}
            {info?.beta ? (
              <Stat label="Beta" value={formatNumber(info.beta)} />
            ) : null}
          </div>
        </>
      )}

      <h3 className="mb-2 mt-5 text-[13px] font-bold text-foreground">
        Performance
      </h3>
      {daily.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {dailyLoading
            ? "Loading history…"
            : "Daily history isn't stored for this symbol."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {performance.map((row) => {
            const value = row.change;
            const positive = (value ?? 0) >= 0;
            return (
              <div
                key={row.id}
                className="rounded-md px-1 py-2 text-center"
                style={{
                  backgroundColor:
                    value === null
                      ? "hsl(var(--muted))"
                      : positive
                        ? "rgba(8,153,129,0.12)"
                        : "rgba(242,54,69,0.12)",
                }}
              >
                <p
                  className="font-mono text-[13px] font-bold"
                  style={{
                    color:
                      value === null
                        ? "hsl(var(--muted-foreground))"
                        : positive
                          ? UP_COLOR
                          : DOWN_COLOR,
                  }}
                >
                  {value === null ? "—" : `${signed(value)}%`}
                </p>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {row.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {seasonality.some((entry) => entry.samples > 0) && (
        <>
          <h3 className="mb-1 mt-5 text-[13px] font-bold text-foreground">
            Seasonals
          </h3>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Average monthly return, from {daily.length.toLocaleString("en-IN")}{" "}
            daily bars
          </p>
          <div
            className="flex h-24 items-stretch gap-1"
            role="img"
            aria-label="Average return by month"
          >
            {seasonality.map((entry) => {
              const value = entry.averageReturn;
              const height =
                value === null ? 0 : (Math.abs(value) / maxReturn) * 100;
              const positive = (value ?? 0) >= 0;
              return (
                <div
                  key={entry.month}
                  className="flex flex-1 flex-col"
                  title={
                    value === null
                      ? `${MONTH_NAMES[entry.month]}: no data`
                      : `${MONTH_NAMES[entry.month]}: ${signed(value)}% average, up ${Math.round(entry.winRate ?? 0)}% of ${entry.samples} years`
                  }
                >
                  <div className="flex flex-1 items-end">
                    {positive && (
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${height}%`,
                          backgroundColor: UP_COLOR,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex flex-1 items-start border-t border-border">
                    {!positive && (
                      <div
                        className="w-full rounded-b-sm"
                        style={{
                          height: `${height}%`,
                          backgroundColor: DOWN_COLOR,
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {MONTHS.map((label, index) => (
              <span
                key={`${label}${index}`}
                className={`flex-1 text-center text-[10px] font-semibold ${
                  index === currentMonth
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <table className="mt-3 w-full border-collapse text-[12px]">
            <caption className="py-1 text-left text-[11px] text-muted-foreground">
              Monthly returns
            </caption>
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-semibold">
                  Month
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-semibold">
                  Avg return
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Win rate
                </th>
              </tr>
            </thead>
            <tbody>
              {seasonality.map((entry) => {
                const value = entry.averageReturn;
                const positive = (value ?? 0) >= 0;
                return (
                  <tr
                    key={entry.month}
                    className="border-t border-border font-mono"
                  >
                    <th
                      scope="row"
                      className={`py-1 pr-2 text-left font-sans font-semibold ${
                        entry.month === currentMonth
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {MONTH_NAMES[entry.month]!.slice(0, 3)}
                    </th>
                    <td
                      className="py-1 pr-2 text-right font-semibold"
                      style={{
                        color:
                          value === null
                            ? "hsl(var(--muted-foreground))"
                            : positive
                              ? UP_COLOR
                              : DOWN_COLOR,
                      }}
                    >
                      {value === null ? "—" : `${signed(value)}%`}
                    </td>
                    <td className="py-1 text-right text-muted-foreground">
                      {entry.winRate === null
                        ? "—"
                        : `${Math.round(entry.winRate)}% (${entry.samples}y)`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
