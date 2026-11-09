"use client";

import {
  formatMonthSpan,
  MonthlyHeatmapSheet,
} from "@/components/market-data/MonthlyHeatmapSheet";
import type { MonthlyHeatmap } from "@/lib/market-data/monthly-heatmap";

function sourceNote(heatmap: MonthlyHeatmap): string {
  const live = heatmap.liveSpan
    ? `Live NIFTY 50 closes (${formatMonthSpan(heatmap.liveSpan)}).`
    : "";
  const archive = heatmap.archiveSpan
    ? ` Archived month-end returns fill ${formatMonthSpan(heatmap.archiveSpan)} where the live feed has no history or a missing session.`
    : "";
  return `Monthly return = month-end close ÷ previous month-end close − 1. CY = compounded calendar-year return; the current month and year update live. Median, SD and Avg use completed months only. ${live}${archive}`;
}

export default function NiftyMonthlyReturnPage() {
  return (
    <MonthlyHeatmapSheet
      title="Nifty Monthly Return"
      endpoint="/api/market-data/nifty-monthly"
      refreshIntervalMs={60_000}
      latestLabel="NIFTY 50"
      sourceNote={sourceNote}
    />
  );
}
