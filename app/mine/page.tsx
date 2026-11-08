import Link from "next/link";
import { EmptyState } from "@/components/DataTable";

/** Mine: watchlist, portfolio, journal. Signed-out visitors get the gate. */
export default function MinePage() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 px-1 text-base font-semibold">Mine</h1>
      <div className="rounded-md border border-line bg-surface">
        <EmptyState
          title="Sign in to see your watchlists, portfolio and journal."
          action={
            <Link href="/login" className="text-sm font-medium text-accent">
              Sign in
            </Link>
          }
        />
      </div>
    </div>
  );
}
