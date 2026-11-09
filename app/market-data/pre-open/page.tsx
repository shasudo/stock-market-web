import Link from "next/link";

const PHASES = [
  { time: "9:00 – 9:08", name: "Order entry", detail: "Collect orders, modify or cancel. No matching yet." },
  { time: "9:08 – 9:12", name: "Matching", detail: "Multilateral matching at a single equilibrium price." },
  { time: "9:12 – 9:15", name: "Buffer", detail: "Transition window before the normal session opens at 9:15." },
];

/** Pre-open session explainer. No live pre-open feed exists, so this page
 *  carries no numbers — it documents the session instead of faking one. */
export default function PreOpenPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Market data</p>
        <h1 className="text-xl font-bold tracking-tight">Pre-open session</h1>
        <p className="mt-0.5 font-mono text-xs tabular-nums text-faint">NSE &amp; BSE · 9:00 – 9:15 IST</p>
      </header>
      <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Phases">
        {PHASES.map((p, i) => (
          <div key={p.name} className={`flex gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}>
            <p className="w-24 shrink-0 font-mono text-xs tabular-nums text-accent">{p.time}</p>
            <div>
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted">{p.detail}</p>
            </div>
          </div>
        ))}
      </section>
      <p className="text-xs text-faint">
        Live pre-open quotes are not published by the data feed. Once the normal session opens, see{" "}
        <Link href="/market-data/indices/nse" className="text-accent">NSE indices</Link> or{" "}
        <Link href="/" className="text-accent">Today</Link>.
      </p>
    </main>
  );
}
