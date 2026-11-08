import Link from "next/link";

/** Terminal-styled 404: wrong ticker, mistyped URL, retired route. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-4 pt-24 text-center">
      <p className="tnum tnum-strong text-5xl text-faint">404</p>
      <h1 className="text-base font-semibold">No such terminal</h1>
      <p className="text-sm text-muted">The page moved, retired, or never existed. The live boards are one jump away.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="min-h-[40px] rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Today
        </Link>
        <Link
          href="/markets"
          className="min-h-[40px] rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium"
        >
          Markets
        </Link>
        <Link
          href="/browse"
          className="min-h-[40px] rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium"
        >
          Browse all
        </Link>
      </div>
      <p className="tnum text-[11px] text-faint">tip: Cmd+K jumps to any live page by code</p>
    </div>
  );
}
