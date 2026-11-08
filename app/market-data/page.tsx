import Link from "next/link";
import { NAV } from "@/lib/nav";

/** Market-data terminal index: every board in one grouped grid. */
export default function MarketDataHomePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4">
      <div className="px-1">
        <h1 className="text-base font-semibold">Market data</h1>
        <p className="text-xs text-muted">Every terminal, grouped by purpose.</p>
      </div>
      {NAV.filter((g) => ["indices", "events", "scans"].includes(g.id)).map((group) => (
        <section key={group.id} aria-label={group.label}>
          <h2 className="tnum px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-faint">
            {group.label}
          </h2>
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((e) => (
              <li key={e.code} className="bg-surface">
                {e.status === "live" ? (
                  <Link href={e.href} className="block px-4 py-3 hover:bg-accent/[0.05]">
                    <span className="block text-sm font-medium">{e.label}</span>
                    <span className="block truncate text-xs text-muted">{e.blurb}</span>
                  </Link>
                ) : (
                  <div className="px-4 py-3 opacity-60">
                    <span className="block text-sm font-medium">
                      {e.label}
                      <span className="tnum ml-2 text-[10px] font-bold uppercase text-faint">{e.status}</span>
                    </span>
                    <span className="block truncate text-xs text-muted">{e.blurb}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
