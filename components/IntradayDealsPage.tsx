"use client";

import DealHistoryPage from "@/components/common/DealHistoryPage";

/**
 * Latest large deals across both types — NSE publishes bulk/block deals
 * once a day (no intraday prints with timestamps exist), so this shows the
 * most recent published deals first with working type tabs.
 */
export default function IntradayDealsPage() {
  return (
    <DealHistoryPage
      dealType="all"
      dealTypeLabel="Deal"
      showTypeTabs
    />
  );
}
