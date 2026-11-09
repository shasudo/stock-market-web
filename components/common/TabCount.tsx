/**
 * The small pill of "how many rows are behind this tab", matching the count
 * already shown on the watchlist folder chips. Rendered even at zero so an
 * empty tab reads as empty rather than as unloaded.
 */
export function TabCount({
  count,
  active = false,
}: {
  count: number;
  active?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none transition-colors ${
        active
          ? "bg-white/25 dark:bg-zinc-950/10 text-white dark:text-zinc-950"
          : "bg-slate-200/80 text-muted-foreground"
      }`}
    >
      {count}
    </span>
  );
}
