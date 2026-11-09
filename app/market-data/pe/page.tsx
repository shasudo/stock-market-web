"use client";

import {
  formatMonthSpan,
  MonthlyHeatmapSheet,
} from "@/components/market-data/MonthlyHeatmapSheet";
import type { MonthlyHeatmap } from "@/lib/market-data/monthly-heatmap";

function sourceNote(heatmap: MonthlyHeatmap): string {
  const span = heatmap.liveSpan ? ` Data: ${formatMonthSpan(heatmap.liveSpan)}.` : "";
  return `Each cell is the NIFTY 50 aggregate trailing P/E (total market cap ÷ total earnings) at month-end; the current month shows the latest daily value. Colors follow the change from the previous month-end (red = P/E fell most, green = rose most within the year). CY = year-end P/E, colored by its change from the prior year-end.${span}`;
}

export default function NiftyPeMonthlyPage() {
  return (
    <MonthlyHeatmapSheet
      title="Nifty PE Ratio"
      endpoint="/api/market-data/pe/monthly"
      refreshIntervalMs={5 * 60_000}
      latestLabel="NIFTY 50 P/E"
      sourceNote={sourceNote}
    />
  );
}
