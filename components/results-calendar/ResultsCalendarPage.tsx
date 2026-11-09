"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import EarningsCalendarView from "./EarningsCalendarView";
import CorporateCalendarView from "./CorporateCalendarView";
import EconomicCalendarView from "./EconomicCalendarView";
import IpoCalendarView from "./IpoCalendarView";
import { PageHeader } from "@/components/common";

type TabType =
  | "Economic Calendar"
  | "Earnings Calendar"
  | "Corporate Calendar"
  | "IPO Calendar";

const tabs: TabType[] = [
  "Earnings Calendar",
  "Corporate Calendar",
  "IPO Calendar",
  "Economic Calendar",
];

export default function ResultsCalendarPage() {
  const [activeTab, setActiveTab] = useState<TabType>("Earnings Calendar");

  const renderContent = () => {
    switch (activeTab) {
      case "Earnings Calendar":
        return <EarningsCalendarView />;
      case "Corporate Calendar":
        return <CorporateCalendarView />;
      case "IPO Calendar":
        return <IpoCalendarView />;
      default:
        return <EconomicCalendarView />;
    }
  };

  return (
    <div className="min-h-screen bg-background py-6 font-sans">
      <div className="w-full px-4 lg:px-8">
        <PageHeader
          title="Results & Corporate Event Calendar"
          description="Upcoming quarterly earnings with live prices, plus dividend, bonus, split, rights, and buyback dates from the latest NSE bhavcopy"
          icon={CalendarRange}
        />

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 mb-6 pb-2 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-primary/20 shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Calendar View Container */}
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden min-h-[500px]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
