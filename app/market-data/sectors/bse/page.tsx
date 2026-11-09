"use client";

import { PieChart } from "lucide-react";
import RealIndexTable from "@/components/market-data/RealIndexTable";

export default function BSESectorsPage() {
  return (
    <RealIndexTable
      exchange="BSE"
      title="BSE Sectors"
      description="Sector-wise Performance on Bombay Stock Exchange"
      icon={PieChart}
      iconWrapperClassName="bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30"
      iconClassName="text-orange-400"
    />
  );
}
