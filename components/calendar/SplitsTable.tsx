"use client";

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
