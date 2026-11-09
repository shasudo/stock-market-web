"use client";

import { FileText } from "lucide-react";
import { TradingBoard } from "@/components/portfolio/TradingBoard";

export default function PaperTradingPage() {
  return (
    <TradingBoard
      mode="paper"
      title="Paper Trading Live"
      description="Positions added from any stock's three-dot menu"
      icon={FileText}
    />
  );
}
