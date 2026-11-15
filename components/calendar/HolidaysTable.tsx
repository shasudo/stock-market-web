"use client";

import { Trash2 } from "lucide-react";

interface HolidayEvent {
  id: string;
  date: string;
  country: string;
  exchange: string;
  holiday: string;
}

interface HolidaysTableProps {
  events: HolidayEvent[];
  onDeleteHoliday?: (id: string) => void;
  customHolidayIds?: string[];
}

export default function HolidaysTable({
  events,
  onDeleteHoliday,
  customHolidayIds = [],
}: HolidaysTableProps) {
  const getFlag = () => {
    return "🏳️";
  };

  const isCustomHoliday = (id: string) => customHolidayIds.includes(id);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-border text-xs font-bold text-muted-foreground">
            <th className="py-2 pl-2">Date</th>
            <th className="py-2">Country</th>
            <th className="py-2">Exchange Name</th>
            <th className="py-2 pr-4">Holiday</th>
            {customHolidayIds.length > 0 && (
              <th className="py-2 pr-2 w-16">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td
                colSpan={customHolidayIds.length > 0 ? 5 : 4}
                className="py-4 text-center text-muted-foreground"
              >
                No events found.
              </td>
            </tr>
          ) : (
            events.map((item) => (
              <tr
                key={item.id}
                className="group hover:bg-muted border-b border-border transition-colors h-[40px]"
              >
                <td className="pl-2 font-bold text-foreground">{item.date}</td>
                <td className="text-foreground flex items-center gap-2 h-[40px] font-semibold text-primary">
                  <span className="text-lg leading-none">{getFlag()}</span>
                  {item.country}
                </td>
                <td className="text-foreground">{item.exchange}</td>
                <td
                  className={`pr-4 font-medium ${isCustomHoliday(item.id) ? "text-primary" : "text-foreground"}`}
                >
                  {item.holiday}
                  {isCustomHoliday(item.id) && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-info/20 text-info rounded-full">
                      Custom
                    </span>
                  )}
                </td>
                {customHolidayIds.length > 0 && (
                  <td className="pr-2">
                    {isCustomHoliday(item.id) && onDeleteHoliday && (
                      <button
                        onClick={() => onDeleteHoliday(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete holiday"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
