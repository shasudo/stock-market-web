"use client";

import { useMemo, useState, type ReactElement } from "react";
import AddEntryModal, { type CalendarTab } from "./AddEntryModal";
import CalendarFilters from "./CalendarFilters";
import CalendarHeader from "./CalendarHeader";
import CalendarTable from "./CalendarTable";
import DividendsTable from "./DividendsTable";
import EarningsTable from "./EarningsTable";
import ExpirationTable from "./ExpirationTable";
import HolidaysTable from "./HolidaysTable";
import IPOTable from "./IPOTable";
import SplitsTable from "./SplitsTable";
import type {
  CustomCalendarData,
  CustomDividend,
  CustomEarning,
  CustomEconomicEvent,
  CustomExpiration,
  CustomHoliday,
  CustomIPO,
  CustomSplit,
} from "@/hooks/useCalendarData";
import { useCalendarData } from "@/hooks/useCalendarData";
import calendarData from "@/data/economic-calendar-data.json";

interface CalendarDataSource {
  economic: CustomEconomicEvent[];
  holidays: CustomHoliday[];
  earnings: CustomEarning[];
  dividends: CustomDividend[];
  splits: CustomSplit[];
  ipo: CustomIPO[];
  expiration: CustomExpiration[];
}

type CalendarRecord =
  | CustomEconomicEvent
  | CustomHoliday
  | CustomEarning
  | CustomDividend
  | CustomSplit
  | CustomIPO
  | CustomExpiration;

const staticCalendarData: CalendarDataSource = calendarData;

const calendarTabs = [
  "Economic Calendar",
  "Holidays",
  "Earnings",
  "Dividends",
  "Splits",
  "IPO",
  "Expiration",
] as const satisfies readonly CalendarTab[];

function hasDate(
  record: CalendarRecord,
): record is CalendarRecord & { date: string } {
  return "date" in record;
}

function isCalendarTab(value: string): value is CalendarTab {
  return calendarTabs.some((calendarTab) => calendarTab === value);
}

export default function EconomicCalendar(): ReactElement {
  const [activeTab, setActiveTab] = useState<CalendarTab>("Economic Calendar");
  const [activeFilter, setActiveFilter] = useState("Today");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const {
    customData,
    isLoaded,
    addEconomicEvent,
    deleteEconomicEvent,
    addHoliday,
    deleteHoliday,
    addEarning,
    deleteEarning,
    addDividend,
    deleteDividend,
    addSplit,
    deleteSplit,
    addIPO,
    deleteIPO,
    addExpiration,
    deleteExpiration,
  } = useCalendarData();

  const filterData = <T extends CalendarRecord>(
    categoryData: readonly T[],
  ): T[] => {
    const requiresRelativeDateFilter =
      activeTab === "Economic Calendar" &&
      (activeFilter === "Yesterday" ||
        activeFilter === "Today" ||
        activeFilter === "Tomorrow");

    if (!requiresRelativeDateFilter) {
      return [...categoryData];
    }

    return categoryData.filter(
      (record) => hasDate(record) && record.date === activeFilter,
    );
  };

  const applySearch = <T extends CalendarRecord>(
    records: readonly T[],
  ): T[] => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return [...records];
    }

    return records.filter((record) =>
      Object.values(record).some((value) =>
        String(value).toLocaleLowerCase().includes(normalizedQuery),
      ),
    );
  };

  const allEconomic = useMemo(
    () => [...staticCalendarData.economic, ...customData.economic],
    [customData.economic],
  );
  const allHolidays = useMemo(
    () => [...staticCalendarData.holidays, ...customData.holidays],
    [customData.holidays],
  );
  const allEarnings = useMemo(
    () => [...staticCalendarData.earnings, ...customData.earnings],
    [customData.earnings],
  );
  const allDividends = useMemo(
    () => [...staticCalendarData.dividends, ...customData.dividends],
    [customData.dividends],
  );
  const allSplits = useMemo(
    () => [...staticCalendarData.splits, ...customData.splits],
    [customData.splits],
  );
  const allIpo = useMemo(
    () => [...staticCalendarData.ipo, ...customData.ipo],
    [customData.ipo],
  );
  const allExpiration = useMemo(
    () => [...staticCalendarData.expiration, ...customData.expiration],
    [customData.expiration],
  );

  const getCustomIds = <T extends keyof CustomCalendarData>(
    category: T,
  ): string[] => customData[category].map((record) => record.id);

  const renderContent = (): ReactElement => {
    if (!isLoaded) {
      return (
        <div role="status" className="p-4 text-center text-muted-foreground">
          Loading...
        </div>
      );
    }

    switch (activeTab) {
      case "Economic Calendar":
        return (
          <CalendarTable
            events={applySearch(filterData(allEconomic))}
            onDeleteEvent={deleteEconomicEvent}
            customEventIds={getCustomIds("economic")}
          />
        );
      case "Holidays":
        return (
          <HolidaysTable
            events={applySearch(filterData(allHolidays))}
            onDeleteHoliday={deleteHoliday}
            customHolidayIds={getCustomIds("holidays")}
          />
        );
      case "Earnings":
        return (
          <EarningsTable
            events={applySearch(filterData(allEarnings))}
            onDeleteEarning={deleteEarning}
            customEarningIds={getCustomIds("earnings")}
          />
        );
      case "Dividends":
        return (
          <DividendsTable
            events={applySearch(filterData(allDividends))}
            onDeleteDividend={deleteDividend}
            customDividendIds={getCustomIds("dividends")}
          />
        );
      case "Splits":
        return (
          <SplitsTable
            events={applySearch(filterData(allSplits))}
            onDeleteSplit={deleteSplit}
            customSplitIds={getCustomIds("splits")}
          />
        );
      case "IPO":
        return (
          <IPOTable
            events={applySearch(filterData(allIpo))}
            onDeleteIPO={deleteIPO}
            customIPOIds={getCustomIds("ipo")}
          />
        );
      case "Expiration":
        return (
          <ExpirationTable
            events={applySearch(filterData(allExpiration))}
            onDeleteExpiration={deleteExpiration}
            customExpirationIds={getCustomIds("expiration")}
          />
        );
    }
  };

  const getAddButtonLabel = (): string => {
    const addButtonLabels: Readonly<Record<CalendarTab, string>> = {
      "Economic Calendar": "Add Event",
      Holidays: "Add Holiday",
      Earnings: "Add Earnings",
      Dividends: "Add Dividend",
      Splits: "Add Split",
      IPO: "Add IPO",
      Expiration: "Add Expiration",
    };

    return addButtonLabels[activeTab];
  };

  return (
    <div className="w-full bg-card font-sans text-foreground">
      <CalendarHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (isCalendarTab(tab)) {
            setActiveTab(tab);
          }
        }}
      />
      <CalendarFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="calendar-search" className="sr-only">
            Search {activeTab}
          </label>
          <input
            id="calendar-search"
            type="search"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-border py-2 pl-10 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <svg
            aria-hidden="true"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {getAddButtonLabel()}
        </button>
      </div>

      <div className="min-h-[300px]">{renderContent()}</div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Real-time {activeTab} provided by Investing.com.</p>
      </div>

      <AddEntryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        activeTab={activeTab}
        onAddEconomic={addEconomicEvent}
        onAddHoliday={addHoliday}
        onAddEarning={addEarning}
        onAddDividend={addDividend}
        onAddSplit={addSplit}
        onAddIPO={addIPO}
        onAddExpiration={addExpiration}
      />
    </div>
  );
}
