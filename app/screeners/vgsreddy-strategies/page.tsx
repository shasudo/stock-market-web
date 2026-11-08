import { StrategiesBoard } from "@/components/mine/StrategiesBoard";

export default function StrategiesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Mine</p>
        <h1 className="text-xl font-bold tracking-tight">Strategies &amp; backtests</h1>
        <p className="mt-0.5 text-xs text-faint">Saved strategies with on-demand backtest runs.</p>
      </header>
      <StrategiesBoard title="Strategies" />
    </main>
  );
}
