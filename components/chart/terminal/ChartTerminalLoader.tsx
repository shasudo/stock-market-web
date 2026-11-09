"use client";

import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import ChartTerminal from "./ChartTerminal";
import { pullAccountState } from "./chart-sync";

/**
 * Brings the account's saved terminal state into this browser before the
 * terminal first reads it, so settings, layouts, favourites and templates made
 * on another device are already there. Falls through after a few seconds when
 * offline, using whatever the browser has.
 */
export default function ChartTerminalLoader({
  symbol,
}: {
  readonly symbol: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void pullAccountState().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <LoadingSpinner message="Loading your chart..." />;
  return <ChartTerminal symbol={symbol} />;
}
