"use client";

import { AuthGuard } from "@/components/common";
import MarketDataTabbedView from "@/components/MarketDataTabbedView";

export default function StocksPage() {
  return (
    <AuthGuard>
      <MarketDataTabbedView initialTab="stocks" />
    </AuthGuard>
  );
}
