import { MoodPanel } from "@/components/market/MoodPanel";

export default function MarketMoodPage() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 px-1 text-base font-semibold">Market mood</h1>
      <MoodPanel />
    </div>
  );
}
