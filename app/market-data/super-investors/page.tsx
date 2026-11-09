import { Suspense } from "react";
import SuperInvestorsPage from "@/components/SuperInvestorsPage";

export default function SuperInvestorsRoute() {
  return (
    <Suspense fallback={null}>
      <SuperInvestorsPage />
    </Suspense>
  );
}
