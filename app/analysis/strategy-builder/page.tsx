import { StrategyBuilderBoard } from "@/components/mine/AnalysisBoards";

export default function StrategyBuilderPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Analysis</p>
        <h1 className="text-xl font-bold tracking-tight">Strategy builder</h1>
        <p className="mt-0.5 text-xs text-faint">Define a strategy, then run backtests against it.</p>
      </header>
      <StrategyBuilderBoard title="Strategy builder" />
    </main>
  );
}
