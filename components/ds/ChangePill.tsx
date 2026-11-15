import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "up" | "down" | "flat";

export function changeTone(value: number | null | undefined): Tone {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

const pillTone =
  "inline-flex min-w-[76px] items-center justify-end gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums";

const tones: Record<Tone, string> = {
  up: "border-emerald-600/25 bg-emerald-600/10 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
  down: "border-rose-600/25 bg-rose-600/10 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300",
  flat: "border-border bg-muted text-muted-foreground",
};

export function ChangePill({
  value,
  suffix = "%",
  className,
}: {
  value: number | null | undefined;
  suffix?: string;
  className?: string;
}) {
  const tone = changeTone(value);
  const Icon = tone === "up" ? TrendingUp : tone === "down" ? TrendingDown : Minus;
  const display =
    value === null || value === undefined || Number.isNaN(value)
      ? `—`
      : `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
  return (
    <span className={cn(pillTone, tones[tone], className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {display}
    </span>
  );
}

export function ChangeText({
  value,
  children,
  className,
}: {
  value: number | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const tone = changeTone(value);
  return (
    <span
      className={cn(
        "tabular-nums",
        tone === "up" && "text-emerald-800 dark:text-emerald-300",
        tone === "down" && "text-rose-800 dark:text-rose-300",
        tone === "flat" && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
