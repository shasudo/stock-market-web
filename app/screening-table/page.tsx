import { ScreeningTable } from "@/components/market/ScreeningTable";

export default function ScreeningTablePage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Screeners</p>
        <h1 className="text-xl font-bold tracking-tight">Screening table</h1>
        <p className="mt-0.5 text-xs text-faint">Filter and sort the live market feed.</p>
      </header>
      <ScreeningTable />
    </main>
  );
}
