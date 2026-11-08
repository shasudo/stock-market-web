"use client";

import { useState } from "react";
import { ChartView } from "@/components/chart/ChartView";

export default function ChartIndicatorsPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [applied, setApplied] = useState("NIFTY");

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Charting</p>
        <h1 className="text-xl font-bold tracking-tight">Chart indicators</h1>
        <p className="mt-0.5 text-xs text-faint">Candles with toggleable SMA and EMA overlays.</p>
      </header>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const s = symbol.trim().toUpperCase();
          if (s !== "") setApplied(s);
        }}
      >
        <label className="sr-only" htmlFor="ci-symbol">Symbol</label>
        <input
          id="ci-symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="NIFTY"
          className="w-44 rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white"
        >
          Load
        </button>
      </form>
      <ChartView
        key={applied}
        symbol={applied}
        defaultOverlays={["sma20", "sma50", "ema12", "ema26"]}
      />
    </main>
  );
}
