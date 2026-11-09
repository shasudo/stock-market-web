"use client";

import { PieChart } from "lucide-react";
import RealIndexTable from "@/components/market-data/RealIndexTable";

export default function NSESectorsPage() {
  return (
    <RealIndexTable
      exchange="NSE"
      title="NSE Sectors"
      description="Sector-wise Performance on National Stock Exchange"
      icon={PieChart}
      iconWrapperClassName="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30"
      iconClassName="text-purple-400"
    />
  );
}
