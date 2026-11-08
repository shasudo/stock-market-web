import { TrendingDown, TrendingUp } from "lucide-react";
import { signedPct, signOf } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Signed, colored, tabular numeral: +2.4% / −1.1%. Renders "—" for nulls. */
export function Num({
  value,
  className,
  strong = false,
}: {
  value: number | null | undefined;
  className?: string;
  strong?: boolean;
}) {
  const sign = signOf(value);
  return (
    <span
      className={cn(
        "tnum",
        strong && "tnum-strong",
        sign > 0 ? "text-up" : sign < 0 ? "text-down" : "text-muted",
        className,
      )}
    >
      {signedPct(value)}
    </span>
  );
}

/** Pill variant for table cells: tinted bg + direction arrow. */
export function ChangePill({ value }: { value: number | null | undefined }) {
  const sign = signOf(value);
  const Icon = sign < 0 ? TrendingDown : TrendingUp;
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        sign > 0 && "bg-up-tint text-up",
        sign < 0 && "bg-down-tint text-down",
        sign === 0 && "bg-transparent text-muted",
      )}
    >
      {sign !== 0 && <Icon size={12} strokeWidth={2.5} aria-hidden />}
      {signedPct(value)}
    </span>
  );
}

/** The one place timestamps live: every data panel ends with this line. */
export function DataStamp({
  label,
  className,
}: {
  label: string | null | undefined;
  className?: string;
}) {
  if (!label) return null;
  return <p className={cn("tnum px-4 py-2 text-right text-[11px] text-faint", className)}>Data as of {label}</p>;
}
