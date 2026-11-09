"use client";

import { AuthGuard } from "@/components/common";
import MarketDataTabbedView from "@/components/MarketDataTabbedView";

export default function IndustryPage() {
  return (
    <AuthGuard>
      <MarketDataTabbedView initialTab="industry" />
    </AuthGuard>
  );
}
