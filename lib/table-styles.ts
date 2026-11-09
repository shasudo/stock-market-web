/**
 * Apple Human Interface Guidelines (HIG) Table & Brand Kit Styling Utilities
 * Provides macOS Sequoia / Apple Stocks-grade styling, frosted headers,
 * precision micro-pill badges, and tabular numeric typography.
 *
 * Colors use the infra token contract (`bg-card`, `border-border`,
 * `text-foreground`, `text-muted-foreground`) so surfaces adapt to dark mode
 * automatically; gain/loss semantics keep their emerald/rose palette in
 * light mode with `dark:` companions tuned for dark-mode contrast.
 */

export const appleTableStyles = {
  container:
    "w-full rounded-2xl border border-border bg-card shadow-xs overflow-hidden",
  scrollWrapper: "w-full overflow-x-auto scrollbar-thin",
  table: "w-full text-left border-collapse text-xs md:text-sm",
  thead: "bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10",
  th: "px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap select-none",
  thSortable:
    "px-3 py-2.5 text-[11px] font-bold text-muted-foreground hover:text-primary uppercase tracking-wider whitespace-nowrap select-none cursor-pointer transition-colors inline-flex items-center gap-1",
  thRight: "px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap select-none",
  thCenter: "px-3 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap select-none",
  tbody: "divide-y divide-border",
  row: "finder-row transition-colors border-b border-border hover:bg-blue-50/60 even:bg-card odd:bg-muted/50 group",
  rowEven: "bg-card",
  rowOdd: "bg-muted/50",
  rowHover: "hover:bg-blue-50/60",
  td: "px-3 py-2.5 text-xs text-foreground font-medium whitespace-nowrap align-middle",
  tdMono: "px-3 py-2.5 text-xs font-mono font-medium text-foreground whitespace-nowrap text-right num-font align-middle",
  tdBold: "px-3 py-2.5 text-xs font-bold text-foreground whitespace-nowrap align-middle",
  tdMuted: "px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap align-middle",
};

// Backwards-compatible alias
export const finderTableStyles = appleTableStyles;

/**
 * Returns color classes and Apple Stocks-style pill styles for price changes
 */
export function getChangeColorClasses(change: number | null | undefined): {
  text: string;
  badge: string;
  border: string;
  iconColor: string;
  pill: string;
} {
  if (change === null || change === undefined || isNaN(change) || change === 0) {
    return {
      text: "text-muted-foreground",
      badge: "bg-muted text-muted-foreground border border-border",
      border: "border-border",
      iconColor: "text-muted-foreground",
      pill: "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-muted text-muted-foreground border border-border num-font",
    };
  }

  if (change > 0) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/30",
      border: "border-emerald-200 dark:border-emerald-400/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      pill: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 num-font dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/30",
    };
  }

  return {
    text: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-50 text-rose-700 border border-rose-200 font-bold dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/30",
    border: "border-rose-200 dark:border-rose-400/30",
    iconColor: "text-rose-600 dark:text-rose-400",
    pill: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 num-font dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/30",
  };
}

/**
 * Returns Apple-style micro badge classes for exchanges
 */
export function getExchangeBadgeClasses(exchange: string): string {
  const norm = exchange?.toUpperCase().trim();
  switch (norm) {
    case "NSE":
      return "bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold rounded-md px-2 py-0.5 text-[11px] dark:bg-indigo-400/10 dark:text-indigo-300 dark:border-indigo-400/30";
    case "BSE":
      return "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 font-bold rounded-md px-2 py-0.5 text-[11px] dark:bg-fuchsia-400/10 dark:text-fuchsia-300 dark:border-fuchsia-400/30";
    case "FNO":
    case "NFO":
      return "bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-md px-2 py-0.5 text-[11px] dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30";
    case "MCX":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-md px-2 py-0.5 text-[11px] dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/30";
    default:
      return "bg-muted text-muted-foreground border border-border font-semibold rounded-md px-2 py-0.5 text-[11px]";
  }
}

/**
 * Returns Apple-style pill class for Market Groups
 */
export function getGroupBadgeClasses(group: string): string {
  const norm = group?.toLowerCase().trim() || "";
  if (norm.includes("large") || norm.includes("nifty 50")) {
    return "bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5 text-[11px] font-bold dark:bg-indigo-400/10 dark:text-indigo-300 dark:border-indigo-400/30";
  }
  if (norm.includes("mid")) {
    return "bg-sky-50 text-sky-700 border border-sky-200 rounded-md px-2 py-0.5 text-[11px] font-bold dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/30";
  }
  if (norm.includes("small") || norm.includes("micro")) {
    return "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded-md px-2 py-0.5 text-[11px] font-bold dark:bg-fuchsia-400/10 dark:text-fuchsia-300 dark:border-fuchsia-400/30";
  }
  if (norm.includes("sme")) {
    return "bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5 text-[11px] font-bold dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30";
  }
  return "bg-muted text-muted-foreground border border-border rounded-md px-2 py-0.5 text-[11px] font-semibold";
}
