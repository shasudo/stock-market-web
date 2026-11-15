import * as React from "react";
import { cn } from "@/lib/utils";

type DsBadgeTone = "neutral" | "blue" | "amber" | "up" | "down";

const tones: Record<DsBadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  blue: "border-primary/25 bg-primary/[0.08] text-primary",
  amber: "border-amber-600/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:border-amber-400/25 dark:bg-amber-400/10",
  up: "border-emerald-600/25 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 dark:border-emerald-400/25 dark:bg-emerald-400/10",
  down: "border-rose-600/25 bg-rose-600/10 text-rose-800 dark:text-rose-300 dark:border-rose-400/25 dark:bg-rose-400/10",
};

export function DsBadge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: DsBadgeTone }) {
  return (
    <span
      data-slot="ds-badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function ExchangeBadge({ exchange, className }: { exchange: string; className?: string }) {
  const norm = exchange?.toUpperCase().trim();
  if (norm === "NSE") return <DsBadge tone="blue" className={className}>{exchange}</DsBadge>;
  if (norm === "FNO" || norm === "NFO") return <DsBadge tone="amber" className={className}>{exchange}</DsBadge>;
  return <DsBadge tone="neutral" className={className}>{exchange}</DsBadge>;
}
