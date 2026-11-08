import { PatternScreener } from "@/components/chart/PatternScreener";

export default function ChartingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Charting</p>
        <h1 className="text-xl font-bold tracking-tight">Pattern screener</h1>
        <p className="mt-0.5 text-xs text-faint">Daily-candle evaluation across the covered universe.</p>
      </header>
      <PatternScreener />
    </main>
  );
}
