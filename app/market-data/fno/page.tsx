import { FuturesBoard } from "@/components/market/FuturesBoard";

/** Same-URL F&O snapshot terminal. Shares the board with /fno. */
export default function FnoTerminalPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <FuturesBoard title="F&O futures" />
      <p className="px-1 text-xs text-muted">
        Chains live on the F&O desk — <a href="/fno" className="font-medium text-accent">open /fno</a>.
      </p>
    </div>
  );
}
