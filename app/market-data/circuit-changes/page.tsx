"use client";

import { AuthGuard } from "@/components/common";
import CircuitChangesView from "@/components/CircuitChangesView";

export default function CircuitChangesPage() {
  return (
    <AuthGuard>
      <CircuitChangesView />
    </AuthGuard>
  );
}
