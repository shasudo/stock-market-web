/**
 * Unified Table & Badge System — single visual language for every table.
 * Structure-preserving: class strings only, no prop or data changes.
 * Containers are 12px cards, headers are muted uppercase, numbers are
 * tabular, hover is a single primary tint in both modes.
 */

export const appleTableStyles = {
  container:
    "w-full rounded-xl border border-border bg-card shadow-sm overflow-hidden",
  scrollWrapper: "w-full overflow-x-auto scrollbar-thin",
  table: "w-full text-left border-collapse text-xs md:text-sm",
  thead: "bg-muted/60 border-b border-border sticky top-0 z-10",
  th: "px-3.5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap select-none",
  thSortable:
    "px-3.5 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider whitespace-nowrap select-none cursor-pointer transition-colors inline-flex items-center gap-1",
  thRight: "px-3.5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap select-none",
  thCenter: "px-3.5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap select-none",
  tbody: "divide-y divide-border",
  row: "transition-colors border-b border-border hover:bg-primary/[0.05] even:bg-card odd:bg-muted/40",
  rowEven: "bg-card",
  rowOdd: "bg-muted/40",
  rowHover: "hover:bg-primary/[0.05]",
  td: "px-3.5 py-2.5 text-[13px] text-foreground font-normal whitespace-nowrap align-middle",
  tdMono: "px-3.5 py-2.5 text-[13px] font-mono font-medium text-foreground whitespace-nowrap text-right num-font align-middle",
  tdBold: "px-3.5 py-2.5 text-[13px] font-semibold text-foreground whitespace-nowrap align-middle",
  tdMuted: "px-3.5 py-2.5 text-[13px] text-muted-foreground whitespace-nowrap align-middle",
};

// Backwards-compatible alias
export const finderTableStyles = appleTableStyles;

/**
 * Returns color classes and pill styles for price changes.
 * Single pill shape (rounded-full, tabular numbers, min-width) so
 * % columns don't jitter between rows.
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
      pill: "inline-flex items-center justify-end gap-1 min-w-[76px] px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-muted text-muted-foreground border border-border num-font",
    };
  }

  if (change > 0) {
    return {
      text: "text-emerald-700 dark:text-emerald-300",
      badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-600/20 font-semibold dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
      border: "border-emerald-600/20 dark:border-emerald-400/25",
      iconColor: "text-emerald-700 dark:text-emerald-300",
      pill: "inline-flex items-center justify-end gap-1 min-w-[76px] px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-600/20 num-font dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25",
    };
  }

  return {
    text: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-500/10 text-rose-700 border border-rose-600/20 font-semibold dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
    border: "border-rose-600/20 dark:border-rose-400/25",
    iconColor: "text-rose-700 dark:text-rose-300",
    pill: "inline-flex items-center justify-end gap-1 min-w-[76px] px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-700 border border-rose-600/20 num-font dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
  };
}

/**
 * Exchange badges: quiet neutrals, one blue for NSE, amber only for derivatives.
 */
export function getExchangeBadgeClasses(exchange: string): string {
  const norm = exchange?.toUpperCase().trim();
  switch (norm) {
    case "NSE":
      return "bg-primary/[0.08] text-primary border border-primary/20 font-semibold rounded-md px-2 py-0.5 text-[11px]";
    case "BSE":
      return "bg-muted text-foreground border border-border font-semibold rounded-md px-2 py-0.5 text-[11px]";
    case "FNO":
    case "NFO":
      return "bg-amber-500/10 text-amber-700 border border-amber-600/20 font-semibold rounded-md px-2 py-0.5 text-[11px] dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25";
    case "MCX":
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-600/20 font-semibold rounded-md px-2 py-0.5 text-[11px] dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25";
    default:
      return "bg-muted text-muted-foreground border border-border font-semibold rounded-md px-2 py-0.5 text-[11px]";
  }
}

/**
 * Market-cap group badges: single neutral style, no rainbow.
 */
export function getGroupBadgeClasses(group: string): string {
  void group;
  return "bg-muted text-muted-foreground border border-border rounded-md px-2 py-0.5 text-[11px] font-semibold";
}
