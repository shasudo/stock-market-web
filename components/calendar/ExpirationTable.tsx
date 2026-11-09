"use client";

interface ExpirationEvent {
  id: string;
  instrument: string;
  contract: string;
  month: string;
  settlement: string;
  rollover: string;
}

interface ExpirationTableProps {
  events: ExpirationEvent[];
  onDeleteExpiration?: (id: string) => void;
  customExpirationIds?: string[];
}

export default function ExpirationTable({
  events,
  onDeleteExpiration,
  customExpirationIds = [],
}: ExpirationTableProps) {
  const isCustom = (id: string) => customExpirationIds.includes(id);
  const hasCustom = customExpirationIds.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-border text-xs font-bold text-muted-foreground">
            <th className="py-2 pl-2 w-[300px]">Instrument</th>
            <th className="py-2">Contract</th>
            <th className="py-2">Month</th>
            <th className="py-2">Settlement</th>
            <th className="py-2 pr-4">Last Rollover</th>
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
                  className={`pl-2 font-semibold flex items-center gap-2 ${isCustom(item.id) ? "text-primary" : "text-primary"}`}
                >
                  <span className="w-4 h-3 bg-muted inline-block rounded-[1px]"></span>
                  {item.instrument}
                  {isCustom(item.id) && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-info/20 text-info rounded-full">
                      Custom
                    </span>
                  )}
                </td>
                <td className="text-foreground">{item.contract}</td>
                <td className="text-foreground">{item.month}</td>
                <td className="text-foreground">{item.settlement}</td>
                <td className="pr-4 text-foreground">{item.rollover}</td>
                {hasCustom && (
                  <td className="pr-2">
                    {isCustom(item.id) && onDeleteExpiration && (
                      <button
                        onClick={() => onDeleteExpiration(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-error/10 rounded-lg transition-colors"
                        title="Delete expiration"
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
