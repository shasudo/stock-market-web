import StockDetailPage from "@/components/StockDetailPage";

export default async function StockDetailRoute({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return <StockDetailPage symbol={decodeURIComponent(symbol)} />;
}
