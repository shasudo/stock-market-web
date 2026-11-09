"use client";

import { use } from "react";
import ChartTerminalLoader from "@/components/chart/terminal/ChartTerminalLoader";
import { AuthGuard } from "@/components/common";

export default function ChartSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);
  return (
    <AuthGuard loadingMessage="Loading chart...">
      <ChartTerminalLoader symbol={decodeURIComponent(symbol)} />
    </AuthGuard>
  );
}
