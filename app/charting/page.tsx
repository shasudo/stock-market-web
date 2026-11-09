"use client";

import { AuthGuard } from "@/components/common";
import { ChartinkScreener } from "@/components/charting/ChartinkScreener";

export default function ChartingPage() {
  return (
    <AuthGuard loadingMessage="Loading screener...">
      <div className="min-h-screen bg-background">
        <ChartinkScreener />
      </div>
    </AuthGuard>
  );
}
