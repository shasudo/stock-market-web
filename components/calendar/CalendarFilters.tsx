"use client";

import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  Clock,
  History,
  type LucideIcon,
} from "lucide-react";

interface CalendarFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function CalendarFilters({
  activeFilter,
  onFilterChange,
}: CalendarFiltersProps) {
  const filters: readonly string[] = ["Yesterday", "Today", "Tomorrow", "This Week", "Next Week"];
  const filterIcons: Record<string, LucideIcon> = {
    Yesterday: History,
    Today: CalendarCheck,
    Tomorrow: CalendarClock,
    "This Week": CalendarRange,
    "Next Week": CalendarPlus,
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const FilterIcon = filterIcons[filter];
            return (
              <button
                key={filter}
                type="button"
                onClick={() => onFilterChange(filter)}
                aria-current={activeFilter === filter ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  activeFilter === filter
                    ? "bg-card border-primary text-primary"
                    : "bg-muted border-transparent text-foreground hover:bg-muted"
                }`}
              >
                {FilterIcon ? <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span>
            Current Time:{" "}
            <span className="font-bold text-foreground">10:23</span> (GMT+5:30)
          </span>
          <ChevronDown className="ml-1 h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="border-l border-border h-3 mx-1"></div>
        <div className="flex items-center gap-1">
          <span>
            Display Time: <span className="text-foreground">remaining</span>
          </span>
          <ChevronDown className="ml-1 h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="ml-auto">
          All data are streaming and updated automatically.
        </div>
      </div>
    </div>
  );
}
