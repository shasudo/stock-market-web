import MarketPerformancePage from "@/components/market/MarketPerformancePage";

export default function DummyTablePage() {
  return (
    <MarketPerformancePage
      enableAddColumns
      settingsScope="market-data-dummy-table"
      theme="vgs"
    />
  );
}
