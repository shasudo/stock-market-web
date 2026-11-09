"use client";

import { AuthGuard } from "@/components/common";
import PriceBandHittersView from "@/components/PriceBandHittersView";

export default function PriceBandHittersPage() {
  return (
    <AuthGuard>
      <PriceBandHittersView />
    </AuthGuard>
  );
}
