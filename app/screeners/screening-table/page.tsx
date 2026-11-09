import MarketPerformancePage from "@/components/market/MarketPerformancePage";

export default function ScreeningTablePage() {
  return (
    <MarketPerformancePage
      enableAddColumns
      settingsScope="screeners-screening-table"
      theme="vgs"
    />
  );
}
