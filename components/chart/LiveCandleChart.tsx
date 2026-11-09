"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { LiveCandleChartProps } from "./LiveCandleChartImpl";

export type { LiveCandleChartProps } from "./LiveCandleChartImpl";

// lightweight-charts touches the DOM and ships ESM only, so it is loaded in
// the browser on demand rather than with every page that can show a chart.
const LiveCandleChart = dynamic<LiveCandleChartProps>(
  () => import("./LiveCandleChartImpl"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-40 w-full items-center justify-center bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    ),
  },
);

export default LiveCandleChart;
