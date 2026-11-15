"use client";

import { Trash2 } from "lucide-react";

interface EarningsEvent {
  id: string;
  date: string;
  time: string;
  company: string;
  eps: string;
  epsForecast: string;
  revenue: string;
  revenueForecast: string;
  marketCap: string;
}

interface EarningsTableProps {
  events: EarningsEvent[];
  onDeleteEarning?: (id: string) => void;
  customEarningIds?: string[];
}

export default function EarningsTable({
  events,
  onDeleteEarning,
  customEarningIds = [],
}: EarningsTableProps) {
  const isCustom = (id: string) => customEarningIds.includes(id);
  const hasCustom = customEarningIds.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-border text-xs font-bold text-muted-foreground">
            <th className="py-2 pl-2">Company</th>
            <th className="py-2 text-right">EPS / Forecast</th>
            <th className="py-2 text-right">Revenue / Forecast</th>
            <th className="py-2 text-right">Market Cap</th>
            <th className="py-2 text-right pr-4">Time</th>
            {hasCustom && <th className="py-2 pr-2 w-12">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td
                colSpan={hasCustom ? 6 : 5}
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
                <td
                  className={`pl-2 font-semibold ${isCustom(item.id) ? "text-primary" : "text-primary"}`}
                >
                  {item.company}
                  {isCustom(item.id) && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-info/20 text-info rounded-full">
                      Custom
                    </span>
                  )}
                </td>
                <td className="text-right text-foreground">
                  <span className="font-bold">{item.eps}</span> /{" "}
                  <span className="text-muted-foreground">
                    {item.epsForecast}
                  </span>
                </td>
                <td className="text-right text-foreground">
                  <span className="font-bold">{item.revenue}</span> /{" "}
                  <span className="text-muted-foreground">
                    {item.revenueForecast}
                  </span>
                </td>
                <td className="text-right text-foreground">{item.marketCap}</td>
                <td className="text-right pr-4 text-muted-foreground text-xs">
                  {item.time}
                </td>
                {hasCustom && (
                  <td className="pr-2">
                    {isCustom(item.id) && onDeleteEarning && (
                      <button
                        onClick={() => onDeleteEarning(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete earning"
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
