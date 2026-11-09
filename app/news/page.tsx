import NewsFlowPage from "@/components/NewsFlowPage";

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-6">
          <NewsFlowPage />
        </div>
      </div>
    </div>
  );
}
