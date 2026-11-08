import { EmptyState } from "@/components/DataTable";

/** Auth arrives with the Mine pass — this route just holds the slot. */
export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md p-4 pt-16">
      <div className="rounded-md border border-line bg-surface p-6">
        <h1 className="text-lg font-bold tracking-tight">Sign in</h1>
        <EmptyState title="Email + password sign-in lands with the Mine pass." />
      </div>
    </div>
  );
}
