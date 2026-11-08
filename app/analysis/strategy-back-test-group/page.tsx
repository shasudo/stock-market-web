import { GroupedRunsBoard } from "@/components/mine/AnalysisBoards";

export default function StrategyBackTestGroupPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Analysis</p>
        <h1 className="text-xl font-bold tracking-tight">Back-tests by strategy</h1>
        <p className="mt-0.5 text-xs text-faint">Runs grouped under the strategy that produced them.</p>
      </header>
      <GroupedRunsBoard title="Back-tests by strategy" />
    </main>
  );
}
