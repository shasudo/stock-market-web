"use client";

import { TrendingUp } from "lucide-react";
import { TradingBoard } from "@/components/portfolio/TradingBoard";

export default function LiveTradingPage() {
  return (
    <TradingBoard
      mode="live"
      title="Live Trading Portfolio"
      description="Positions added from any stock's three-dot menu"
      icon={TrendingUp}
    />
  );
}
