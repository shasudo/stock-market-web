import { AllRunsBoard } from "@/components/mine/AnalysisBoards";

export default function StrategyBackTestPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Analysis</p>
        <h1 className="text-xl font-bold tracking-tight">Strategy back-tests</h1>
        <p className="mt-0.5 text-xs text-faint">Every run across all strategies, newest context per card.</p>
      </header>
      <AllRunsBoard title="Back-tests" />
    </main>
  );
}
