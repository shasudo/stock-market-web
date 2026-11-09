import type { Metadata } from "next";
import FnoSnapshotPage from "@/components/fno/FnoSnapshotPage";

export const metadata: Metadata = {
  title: "F&O Market Snapshot – Futures, Option Chain, OI & Arbitrage",
  description:
    "Live NSE futures and options: index and stock futures quotes, option chains with PCR and max pain, open interest analysis, build-ups, arbitrage, ban list and F&O breadth.",
};

export default function Page() {
  return <FnoSnapshotPage />;
}
