"use client";

import { useMemo } from "react";
import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  formatIndicatorTitle,
  formatIndicatorValue,
  resolvePrecision,
  type IndicatorInstance,
  type IndicatorSeriesMap,
  producesValues,
} from "@/lib/technical/indicator-schema";
import type { ChartCandle } from "@/lib/market/chart-candles";
import { DOWN_COLOR, UP_COLOR, formatNumber } from "./ui";

interface DataPanelProps {
  readonly symbol: string;
  readonly candles: readonly ChartCandle[];
  /** Hovered bar, or null for the last bar. */
  readonly activeIndex: number | null;
  readonly instances: readonly IndicatorInstance[];
  readonly series: Readonly<Record<string, IndicatorSeriesMap>>;
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

/**
 * TradingView-style docked Data window: OHLCV plus visible indicator values
 * at the hovered bar (last bar when idle), then the recent-bars table.
 */
export default function DataPanel({
  symbol,
  candles,
  activeIndex,
  instances,
  series,
}: DataPanelProps) {
  const index =
    activeIndex !== null && activeIndex < candles.length
      ? activeIndex
      : candles.length - 1;
  const candle = index >= 0 ? candles[index] : undefined;
  const change =
    candle && candle.open > 0
      ? ((candle.close - candle.open) / candle.open) * 100
      : null;
  const up = (change ?? 0) >= 0;

  const readouts = useMemo(
    () =>
      instances.flatMap((instance) => {
        if (instance.hidden) return [];
        const definition = getIndicatorDefinition(instance.definitionId);
        if (!definition) return [];
        const instanceSeries = series[instance.instanceId];
        return definition.plots
          .filter(
                  (plot) =>
                    instance.plotStyles[plot.id]?.visible &&
                    producesValues(instanceSeries?.[plot.id]),
                )
          .map((plot) => {
            const values = instanceSeries?.[plot.id];
            const value = values && index >= 0 ? (values[index] ?? null) : null;
            return {
              key: `${instance.instanceId}:${plot.id}`,
              label: `${formatIndicatorTitle(definition, instance)} · ${plot.id}`,
              color: instance.plotStyles[plot.id].color,
              text: formatIndicatorValue(
                value,
                resolvePrecision(definition, instance),
              ),
            };
          });
      }),
    [instances, series, index],
  );

  const rows = candles.slice(-100).reverse();

  return (
    <section aria-label="Data window" className="px-3 py-2">
      <p className="pb-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        {symbol} · {candle ? timeLabel(candle.time) : "No data"}
      </p>
      {candle ? (
        <div className="divide-y divide-border">
          <Stat label="Open" value={formatNumber(candle.open)} />
          <Stat label="High" value={formatNumber(candle.high)} />
          <Stat label="Low" value={formatNumber(candle.low)} />
          <Stat label="Close" value={formatNumber(candle.close)} />
          <div className="flex items-center justify-between py-1 text-[12.5px]">
            <span className="text-muted-foreground">Change</span>
            <span
              className="font-mono font-semibold tabular-nums"
              style={{ color: up ? UP_COLOR : DOWN_COLOR }}
            >
              {change === null ? "—" : `${up ? "+" : ""}${change.toFixed(2)}%`}
            </span>
          </div>
          <Stat
            label="Volume"
            value={Math.round(candle.volume).toLocaleString("en-IN")}
          />
          {readouts.map((readout) => (
            <div
              key={readout.key}
              className="flex items-center justify-between py-1 text-[12.5px]"
            >
              <span className="truncate pr-2 text-muted-foreground">
                {readout.label}
              </span>
              <span
                className="font-mono font-semibold tabular-nums"
                style={{ color: readout.color }}
              >
                {readout.text}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-[13px] text-muted-foreground">
          No bars loaded.
        </p>
      )}
      {rows.length > 0 && (
        <table className="mt-3 w-full border-collapse text-right text-[11.5px]">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1 text-left font-medium">Time</th>
              <th className="py-1 font-medium">O</th>
              <th className="py-1 font-medium">H</th>
              <th className="py-1 font-medium">L</th>
              <th className="py-1 font-medium">C</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, reversed) => {
              const rowIndex = candles.length - 1 - reversed;
              return (
                <tr
                  key={String(row.time)}
                  className={`border-b border-border tabular-nums ${
                    rowIndex === index
                      ? "bg-primary/10 font-semibold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <td className="py-1 text-left">{timeLabel(row.time)}</td>
                  <td className="py-1">{formatNumber(row.open)}</td>
                  <td className="py-1">{formatNumber(row.high)}</td>
                  <td className="py-1">{formatNumber(row.low)}</td>
                  <td className="py-1">{formatNumber(row.close)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
