import Link from "next/link";
import { NAV, type NavStatus } from "@/lib/nav";
import { cn } from "@/lib/cn";

const STATUS: Record<NavStatus, { label: string; className: string }> = {
  live: { label: "live", className: "bg-up-tint text-up" },
  next: { label: "next", className: "bg-warn-tint text-warn" },
  later: { label: "later", className: "bg-down-tint text-down" },
};

/** Browse: every destination the terminal will ever have, grouped by purpose.
 *  Live pages link; queued ones show their state honestly. */
export default function BrowsePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4">
      <div className="px-1">
        <h1 className="text-base font-semibold">Browse</h1>
        <p className="text-xs text-muted">Every page, grouped by purpose. Cmd+K jumps anywhere live.</p>
      </div>
      {NAV.map((group) => (
        <section key={group.id} aria-label={group.label}>
          <h2 className="tnum px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-faint">
            {group.label}
          </h2>
          <ul className="overflow-hidden rounded-md border border-line bg-surface">
            {group.entries.map((e) => {
              const s = STATUS[e.status];
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.label}</span>
                    <span className="block truncate text-xs text-muted">{e.blurb}</span>
                  </span>
                  <span
                    className={cn(
                      "tnum shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      s.className,
                    )}
                  >
                    {s.label}
                  </span>
                </>
              );
              return (
                <li key={e.code} className="border-b border-line last:border-0">
                  {e.status === "live" ? (
                    <Link href={e.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/[0.05]">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-2.5 opacity-70">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
