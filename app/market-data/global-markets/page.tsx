"use client";

import { AuthGuard } from "@/components/common";
import GlobalMarketsView from "@/components/global-markets/GlobalMarketsView";

export default function GlobalMarketsPage() {
  return (
    <AuthGuard loadingMessage="Loading global markets...">
      <GlobalMarketsView />
    </AuthGuard>
  );
}
