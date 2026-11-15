import NewsFlowPage from "@/components/NewsFlowPage";

export default function NewsPage() {
  return (
    <div>
      <div className="w-full">
        <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--card-shadow)]">
          <NewsFlowPage />
        </div>
      </div>
    </div>
  );
}
