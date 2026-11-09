"use client";

import { AuthGuard } from "@/components/common";
import MarketDataTabbedView from "@/components/MarketDataTabbedView";

export default function SectorsPage() {
  return (
    <AuthGuard>
      <MarketDataTabbedView initialTab="sectors" />
    </AuthGuard>
  );
}
