"use client";

import { X } from "lucide-react";
import type { ChartCandle } from "@/lib/market/chart-candles";
import { formatNumber } from "./ui";

interface DataWindowDialogProps {
  readonly symbol: string;
  readonly candles: readonly ChartCandle[];
  readonly onClose: () => void;
}

function timeLabel(time: ChartCandle["time"]): string {
  if (typeof time === "string") return time;
  return new Date(time * 1000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** TradingView's Table view: recent bars as an OHLCV table. */
export default function DataWindowDialog({
  symbol,
  candles,
  onClose,
}: DataWindowDialogProps) {
  const rows = candles.slice(-100).reverse();
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} data table`}
        className="flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[16px] font-bold text-foreground">
            {symbol} · Table view
          </h2>
          <button
            type="button"
            aria-label="Close table view"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No bars loaded.</p>
          ) : (
            <table className="w-full border-collapse text-right text-[12px]">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Time</th>
                  <th className="py-1.5 font-medium">Open</th>
                  <th className="py-1.5 font-medium">High</th>
                  <th className="py-1.5 font-medium">Low</th>
                  <th className="py-1.5 font-medium">Close</th>
                  <th className="py-1.5 font-medium">Change %</th>
                  <th className="py-1.5 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((candle) => {
                  const change =
                    candle.open > 0
                      ? ((candle.close - candle.open) / candle.open) * 100
                      : 0;
                  const up = change >= 0;
                  return (
                    <tr
                      key={String(candle.time)}
                      className="border-b border-border text-foreground"
                    >
                      <td className="py-1 text-left text-muted-foreground">
                        {timeLabel(candle.time)}
                      </td>
                      <td className="py-1 tabular-nums">
                        {formatNumber(candle.open)}
                      </td>
                      <td className="py-1 tabular-nums">
                        {formatNumber(candle.high)}
                      </td>
                      <td className="py-1 tabular-nums">
                        {formatNumber(candle.low)}
                      </td>
                      <td className="py-1 tabular-nums">
                        {formatNumber(candle.close)}
                      </td>
                      <td
                        className={`py-1 tabular-nums ${up ? "text-success" : "text-error"}`}
                      >
                        {up ? "+" : ""}
                        {change.toFixed(2)}%
                      </td>
                      <td className="py-1 tabular-nums text-muted-foreground">
                        {Math.round(candle.volume).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
