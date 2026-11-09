import { NewsFeed } from "@/components/market/NewsFeed";

export default function NewsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-faint">Flows</p>
        <h1 className="text-xl font-bold tracking-tight">News flow</h1>
        <p className="mt-0.5 text-xs text-faint">Corporate actions, bulk and block deals in one feed.</p>
      </header>
      <NewsFeed />
    </main>
  );
}
