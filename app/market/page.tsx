import MarketPerformancePage from "@/components/market/MarketPerformancePage";

export default function MarketPage() {
  return (
    <MarketPerformancePage
      enableAddColumns
      settingsScope="market"
      theme="vgs"
      includeEtfs
    />
  );
}
