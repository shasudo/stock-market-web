"use client";

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
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
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
