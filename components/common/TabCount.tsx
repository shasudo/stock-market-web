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
      className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums leading-none transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {count}
    </span>
  );
}
