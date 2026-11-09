"use client";

import { useMemo, useState } from "react";
import { FunctionSquare } from "lucide-react";

import IndicatorLegend from "@/components/chart/IndicatorLegend";
import IndicatorPicker from "@/components/chart/IndicatorPicker";
import IndicatorSettingsDialog from "@/components/chart/IndicatorSettingsDialog";
import { useChartIndicators } from "@/components/chart/useChartIndicators";
import { getIndicatorDefinition } from "@/lib/technical/indicator-catalog";
import {
  type IndicatorPlot,
  type PlotStyle,
  formatIndicatorTitle,
  formatIndicatorValue,
  resolvePrecision,
} from "@/lib/technical/indicator-schema";
import type { Candle } from "@/lib/technical/types";

const DAY_MS = 86_400_000;
const CANDLE_COUNT = 320;

/**
 * A deterministic walk keeps the server and client renders identical; this page
 * only exists to exercise the indicator settings system without a live feed.
 */
function buildSampleCandles(): Candle[] {
  const candles: Candle[] = [];
  let close = 18_000;

  for (let index = 0; index < CANDLE_COUNT; index += 1) {
    const drift = Math.sin(index / 9) * 60 + Math.sin(index / 31) * 180;
    const open = close;
    close = Math.max(1, open + drift + (index % 7) * 12 - 36);
    candles.push({
      timestamp: 1_600_000_000_000 + index * DAY_MS,
      open,
      high: Math.max(open, close) + 40 + (index % 5) * 8,
      low: Math.min(open, close) - 40 - (index % 4) * 9,
      close,
      volume: 900_000 + (index % 23) * 41_000,
    });
  }

  return candles;
}

export default function ChartIndicatorsPreviewPage() {
  const candles = useMemo(() => buildSampleCandles(), []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    instances,
    series,
    addIndicator,
    updateIndicator,
    removeIndicator,
    toggleHidden,
    saveAsDefault,
    clearDefault,
    getInstance,
  } = useChartIndicators({
    candles,
    initialDefinitionIds: ["smma", "rsi"],
  });

  const editing = editingId ? getInstance(editingId) : undefined;

  return (
    <main className="w-full px-4 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Indicator settings preview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every indicator declares its own inputs, plots, levels and fills. Open
          the settings of any row to see the properties it exposes.
        </p>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
        >
          <FunctionSquare className="h-4 w-4" />
          Indicators
        </button>
        <span className="text-xs text-muted-foreground">
          {instances.length} active · {candles.length} sample candles
        </span>
      </div>

      <div className="rounded border border-border bg-muted p-3">
        <IndicatorLegend
          instances={instances}
          series={series}
          onToggleHidden={toggleHidden}
          onOpenSettings={setEditingId}
          onShowSource={() => undefined}
          onOpenMenu={() => undefined}
          onRemove={removeIndicator}
        />
        {instances.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No indicators yet — add one to begin.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {instances.map((instance) => {
          const definition = getIndicatorDefinition(instance.definitionId);
          if (!definition) return null;
          const instanceSeries = series[instance.instanceId];

          return (
            <section
              key={instance.instanceId}
              className="rounded border border-border p-4"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  {formatIndicatorTitle(definition, instance)}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {definition.pane === "price" ? "price pane" : "own pane"} ·{" "}
                  {definition.category}
                </span>
              </div>

              <dl className="mt-3 space-y-1">
                {definition.plots.map((plot) => {
                  const style = instance.plotStyles[plot.id];
                  const values = instanceSeries?.[plot.id];
                  const last = values
                    ? (values[values.length - 1] ?? null)
                    : null;

                  return (
                    <div
                      key={plot.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <StyleSwatch plot={plot} style={style} />
                      <dt className="w-40 text-muted-foreground">
                        {plot.label}
                      </dt>
                      <dd
                        className="tabular-nums"
                        style={{
                          color: style.visible ? style.color : "#9ca3af",
                        }}
                      >
                        {formatIndicatorValue(
                          last,
                          resolvePrecision(definition, instance),
                        )}
                      </dd>
                      {!style.visible && (
                        <span className="text-xs text-muted-foreground">
                          hidden
                        </span>
                      )}
                    </div>
                  );
                })}
              </dl>

              {definition.levels.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Levels:{" "}
                  {definition.levels
                    .map(
                      (level) =>
                        `${level.label} ${instance.levelValues[level.id]}`,
                    )
                    .join(" · ")}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <IndicatorPicker
        open={pickerOpen}
        onSelect={(definitionId) => {
          const created = addIndicator(definitionId);
          if (created) setEditingId(created);
        }}
        onClose={() => setPickerOpen(false)}
      />

      {editing && (
        <IndicatorSettingsDialog
          key={editing.instanceId}
          instance={editing}
          onApply={updateIndicator}
          onClose={() => setEditingId(null)}
          onSaveAsDefault={saveAsDefault}
          onClearDefault={clearDefault}
        />
      )}
    </main>
  );
}

/** Draws the plot exactly as its style says it should be stroked. */
function StyleSwatch({
  plot,
  style,
}: {
  plot: IndicatorPlot;
  style: PlotStyle;
}) {
  if (!style.visible) {
    return <span className="h-2 w-8 rounded bg-muted" aria-hidden />;
  }

  if (plot.kind !== "line") {
    return (
      <span
        aria-hidden
        className="h-2 w-8 rounded"
        style={{
          backgroundColor:
            plot.colorMode === "fixed" ? style.color : style.upColor,
          opacity: style.opacity / 100,
        }}
      />
    );
  }

  return (
    <svg width="32" height="8" aria-hidden className="shrink-0">
      <line
        x1="0"
        y1="4"
        x2="32"
        y2="4"
        stroke={style.color}
        strokeWidth={style.lineWidth}
        strokeDasharray={
          style.lineStyle === "dashed"
            ? "5 3"
            : style.lineStyle === "dotted"
              ? "1 3"
              : undefined
        }
        strokeLinecap="round"
      />
    </svg>
  );
}
