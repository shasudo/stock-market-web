import { Suspense } from "react";
import { NotesBoard } from "@/components/mine/JournalBoards";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-4 text-sm text-muted">Loading…</div>}>
      <NotesBoard />
    </Suspense>
  );
}
