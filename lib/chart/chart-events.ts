/**
 * Shared wiring between the embeddable chart and the indicator/alert panels
 * built by other builders. The full terminal opens its own dialogs; the
 * embeddable chart has no panels of its own, so its toolbar buttons dispatch
 * these window events and any mounted panel can respond. Stable element ids
 * stay fixed so panels can find or trigger the buttons directly:
 * `chart-symbol-search`, `chart-type-switch` (terminal; the embeddable chart
 * uses `chart-core-style-candles|line|area`), `chart-indicators-button`,
 * `chart-alerts-button`, `chart-range-1D…ALL` (terminal; the embeddable chart
 * uses `chart-core-range-…`), `chart-date-picker` (terminal; the embeddable
 * chart uses `chart-core-date-picker`).
 */

export const CHART_INDICATORS_EVENT = "chart:open-indicators";
export const CHART_ALERTS_EVENT = "chart:open-alerts";

export interface ChartPanelDetail {
  readonly symbol: string;
  readonly price: number | null;
}

function dispatch(name: string, detail: ChartPanelDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChartPanelDetail>(name, { detail }));
}

/** Ask the indicators panel to open for a symbol. */
export function openChartIndicators(symbol: string): void {
  dispatch(CHART_INDICATORS_EVENT, { symbol, price: null });
}

/** Ask the alert panel to open for a symbol at an optional price. */
export function openChartAlerts(
  symbol: string,
  price: number | null = null,
): void {
  dispatch(CHART_ALERTS_EVENT, { symbol, price });
}
