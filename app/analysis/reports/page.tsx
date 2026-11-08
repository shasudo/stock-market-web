import { ReportsBoard } from "@/components/mine/AnalysisBoards";

export default function ReportsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Analysis</p>
        <h1 className="text-xl font-bold tracking-tight">Reports</h1>
        <p className="mt-0.5 text-xs text-faint">Run and trade counts per strategy.</p>
      </header>
      <ReportsBoard title="Reports" />
    </main>
  );
}
