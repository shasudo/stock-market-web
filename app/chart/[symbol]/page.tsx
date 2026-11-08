import { ChartView } from "@/components/chart/ChartView";

export default async function ChartSymbolPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <ChartView symbol={decodeURIComponent(symbol)} />
    </main>
  );
}
