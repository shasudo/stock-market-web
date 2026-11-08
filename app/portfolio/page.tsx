import Link from "next/link";

const CARDS = [
  { href: "/portfolio/holdings", title: "Holdings", blurb: "Delivery book and average prices" },
  { href: "/portfolio/paper-trading", title: "Paper trading", blurb: "Play-money positions, marked to LTP" },
  { href: "/portfolio/live-trading", title: "Live trading", blurb: "Real book, broker-reconciled" },
  { href: "/watchlist", title: "Watchlist", blurb: "Opportunity set and levels" },
  { href: "/alerts", title: "Alerts", blurb: "Price rules that wake you up" },
];

/** Portfolio hub: the book, the practice book, and everything around them. */
export default function PortfolioPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <div className="px-1">
        <h1 className="text-base font-semibold">Portfolio</h1>
        <p className="text-xs text-muted">Holdings and trading books, paper and live.</p>
      </div>
      <ul className="overflow-hidden rounded-md border border-line bg-surface">
        {CARDS.map((c) => (
          <li key={c.href} className="border-b border-line last:border-0">
            <Link href={c.href} className="flex items-baseline gap-3 px-4 py-3 hover:bg-accent/[0.05]">
              <span className="text-sm font-medium">{c.title}</span>
              <span className="truncate text-xs text-muted">{c.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
