"use client";

import { Trash2 } from "lucide-react";

interface SplitEvent {
  id: string;
  date: string;
  company: string;
  ratio: string;
  exDate?: string;
}

interface SplitsTableProps {
  events: SplitEvent[];
  onDeleteSplit?: (id: string) => void;
  customSplitIds?: string[];
}

export default function SplitsTable({
  events,
  onDeleteSplit,
  customSplitIds = [],
}: SplitsTableProps) {
  const isCustom = (id: string) => customSplitIds.includes(id);
  const hasCustom = customSplitIds.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-border text-xs font-bold text-muted-foreground">
            <th className="py-2 pl-2">Split date</th>
            <th className="py-2">Company</th>
            <th className="py-2 text-right pr-4">Split ratio</th>
            {hasCustom && <th className="py-2 pr-2 w-12">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td
                colSpan={hasCustom ? 4 : 3}
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
                <td className="pl-2 text-foreground font-bold">{item.date}</td>
                <td
                  className={`font-semibold ${isCustom(item.id) ? "text-primary" : "text-primary"}`}
                >
                  {item.company}
                  {isCustom(item.id) && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-info/20 text-info rounded-full">
                      Custom
                    </span>
                  )}
                </td>
                <td className="text-right pr-4 text-foreground">
                  {item.ratio}
                </td>
                {hasCustom && (
                  <td className="pr-2">
                    {isCustom(item.id) && onDeleteSplit && (
                      <button
                        onClick={() => onDeleteSplit(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete split"
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
