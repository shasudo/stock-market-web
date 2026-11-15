import * as React from "react";
import { cn } from "@/lib/utils";
import { changeTone } from "./ChangePill";

export function Stat({
  label,
  value,
  change,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  change?: number | null;
  hint?: string;
  className?: string;
}) {
  const tone = changeTone(change ?? null);
  return (
    <div data-slot="ds-stat" className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {(change !== undefined || hint) && (
        <p
          className={cn(
            "mt-0.5 text-xs font-medium tabular-nums",
            tone === "up" && "text-emerald-700 dark:text-emerald-300",
            tone === "down" && "text-rose-700 dark:text-rose-300",
            tone === "flat" && "text-muted-foreground",
          )}
        >
          {change !== undefined && change !== null && !Number.isNaN(change)
            ? `${change > 0 ? "+" : ""}${change.toFixed(2)}%`
            : null}
          {hint ? ` · ${hint}` : null}
        </p>
      )}
    </div>
  );
}
