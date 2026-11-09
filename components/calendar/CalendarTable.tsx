"use client";

import { Star, Trash2 } from "lucide-react";

interface CalendarEvent {
  id: string;
  time: string;
  currency: string;
  event: string;
  importance: number;
  actual: string;
  forecast: string;
  previous: string;
}

interface CalendarTableProps {
  events: CalendarEvent[];
  onDeleteEvent?: (id: string) => void;
  customEventIds?: string[];
}

export default function CalendarTable({
  events,
  onDeleteEvent,
  customEventIds = [],
}: CalendarTableProps) {
  const renderStars = (importance: number) => {
    return (
      <div className="flex gap-[2px]">
        {[1, 2, 3].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i <= importance
                ? "fill-amber-400 text-amber-400"
                : "fill-muted text-muted-foreground"
            }`}
          />
        ))}
      </div>
    );
  };

  const getFlag = (currency: string) => {
    const flags: Record<string, string> = {
      USD: "🇺🇸",
      EUR: "🇪🇺",
      GBP: "🇬🇧",
      JPY: "🇯🇵",
      AUD: "🇦🇺",
      NZD: "🇳🇿",
      CAD: "🇨🇦",
      CHF: "🇨🇭",
      CNY: "🇨🇳",
      INR: "🇮🇳",
      BRL: "🇧🇷",
      ZAR: "🇿🇦",
      MXN: "🇲🇽",
      RUB: "🇷🇺",
      KRW: "🇰🇷",
      SGD: "🇸🇬",
      HKD: "🇭🇰",
    };
    return flags[currency] || "🏳️";
  };

  const isCustom = (id: string) => customEventIds.includes(id);
  const hasCustom = customEventIds.length > 0;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/90 bg-card shadow-xs scrollbar-thin">
      <table className="w-full text-left border-collapse text-xs md:text-sm">
        <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
          <tr>
            <th className="py-3 px-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-[90px]">
              Time
            </th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-[80px]">
              Currency
            </th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-[90px]">
              Impact
            </th>
            <th className="py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
              Economic Release Event
            </th>
            <th className="py-3 px-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-[90px]">
              Actual
            </th>
            <th className="py-3 px-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-[90px]">
              Forecast
            </th>
            <th className="py-3 px-3.5 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-[90px]">
              Previous
            </th>
            {hasCustom && (
              <th className="py-3 px-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none w-14">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr className="bg-primary/10 border-y border-primary/20">
            <td
              colSpan={hasCustom ? 8 : 7}
              className="py-2.5 px-3.5 text-center font-bold text-primary text-xs uppercase tracking-wide"
            >
              Economic Calendar Releases
            </td>
          </tr>

          {events.length === 0 ? (
            <tr>
              <td
                colSpan={hasCustom ? 8 : 7}
                className="py-16 text-center text-xs text-muted-foreground"
              >
                No economic events scheduled for this window.
              </td>
            </tr>
          ) : (
            events.map((item) => (
              <tr
                key={item.id}
                className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
              >
                <td className="py-2.5 px-3.5 text-muted-foreground font-mono font-bold num-font whitespace-nowrap">
                  {item.time}
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-foreground font-mono font-bold text-xs border border-border">
                    <span className="text-sm leading-none">
                      {getFlag(item.currency)}
                    </span>
                    {item.currency}
                  </div>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div title={`Impact: ${item.importance}/3`}>
                    {renderStars(item.importance)}
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`font-semibold hover:text-primary cursor-pointer transition-colors ${
                      isCustom(item.id) ? "text-primary font-bold" : "text-foreground"
                    }`}
                  >
                    {item.event}
                  </span>
                  {isCustom(item.id) && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full border border-primary/30">
                      Custom
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground num-font whitespace-nowrap">
                  {item.actual || "—"}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                  {item.forecast || "—"}
                </td>
                <td className="py-2.5 px-3.5 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                  {item.previous || "—"}
                </td>
                {hasCustom && (
                  <td className="py-2.5 px-3 text-center">
                    {isCustom(item.id) && onDeleteEvent && (
                      <button
                        onClick={() => onDeleteEvent(item.id)}
                        className="p-1 text-muted-foreground hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
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
