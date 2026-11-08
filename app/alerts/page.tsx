import Link from "next/link";
import { EmptyState } from "@/components/DataTable";

/** Alerts: fired notifications + configured rules. Signed-out gate for now. */
export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <h1 className="mb-3 px-1 text-base font-semibold">Alerts</h1>
      <div className="rounded-md border border-line bg-surface">
        <EmptyState
          title="Sign in to manage price alerts."
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
