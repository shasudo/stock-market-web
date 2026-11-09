"use client";

import { AuthGuard } from "@/components/common";
import MarketDataTabbedView from "@/components/MarketDataTabbedView";

export default function FNOStocksPage() {
  return (
    <AuthGuard>
      <MarketDataTabbedView initialTab="fnoStocks" />
    </AuthGuard>
  );
}
