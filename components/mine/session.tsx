"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { me, restoreSession, signedIn } from "@/lib/auth";
import type { UserView } from "@/lib/types";
import { EmptyState } from "../DataTable";

/** Shared signed-in gate for Mine pages. */
export function useSession() {
  const [user, setUser] = useState<UserView | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    restoreSession();
    if (!signedIn()) {
      setChecked(true);
      return;
    }
    let live = true;
    me().then((u) => {
      if (live) {
        setUser(u);
        setChecked(true);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return { user, checked };
}

export function SessionGate({
  checked,
  user,
  title,
  children,
}: {
  checked: boolean;
  user: UserView | null;
  title: string;
  children: React.ReactNode;
}) {
  if (!checked) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <div className="rounded-md border border-line bg-surface p-6 text-sm text-muted">Checking session…</div>
      </div>
    );
  }
  if (user == null) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <h1 className="mb-3 px-1 text-base font-semibold">{title}</h1>
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            title={`Sign in to see your ${title.toLowerCase()}.`}
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
  return <>{children}</>;
}
