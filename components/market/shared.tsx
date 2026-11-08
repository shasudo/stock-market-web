import { cn } from "@/lib/cn";

export type Exchange = "NSE" | "BSE";

export function ExchangeToggle({ value, onChange }: { value: Exchange; onChange: (e: Exchange) => void }) {
  return (
    <div role="group" aria-label="Exchange" className="flex rounded-md border border-line p-0.5">
      {(["NSE", "BSE"] as Exchange[]).map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onChange(ex)}
          aria-pressed={value === ex}
          className={cn(
            "min-h-[32px] rounded-sm px-3 text-[13px] font-medium",
            value === ex ? "bg-accent/10 text-accent" : "text-muted hover:text-fg",
          )}
        >
          {ex}
        </button>
      ))}
    </div>
  );
}

export function StaleBadge() {
  return (
    <span className="rounded-full bg-warn-tint px-2 py-0.5 text-[10px] font-semibold text-warn">
      STALE — showing last good data
    </span>
  );
}
