"use client";

import { useState } from "react";
import {
  Building2,
  CalendarRange,
  Landmark,
  Newspaper,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import EarningsCalendarView from "./EarningsCalendarView";
import CorporateCalendarView from "./CorporateCalendarView";
import EconomicCalendarView from "./EconomicCalendarView";
import IpoCalendarView from "./IpoCalendarView";
import { PageHeader } from "@/components/ds";

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

const tabIcons: Record<TabType, LucideIcon> = {
  "Earnings Calendar": Newspaper,
  "Corporate Calendar": Building2,
  "IPO Calendar": Rocket,
  "Economic Calendar": Landmark,
};

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
    <div>
      <div className="w-full">
        <PageHeader
          title="Results & Corporate Event Calendar"
          description="Upcoming quarterly earnings with live prices, plus dividend, bonus, split, rights, and buyback dates from the latest NSE bhavcopy"
          icon={CalendarRange}
        />

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 mb-6 pb-2 border-b border-border">
          {tabs.map((tab) => {
            const TabIcon = tabIcons[tab];
            return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-primary/20 shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {tab}
            </button>
            );
          })}
        </div>

        {/* Calendar View Container */}
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--card-shadow)] min-h-[500px]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
