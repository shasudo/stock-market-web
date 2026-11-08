"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { logout, me, restoreSession, signedIn } from "@/lib/auth";
import type { UserView, WatchlistsResponse } from "@/lib/types";
import { ChangePill } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { useRouter } from "next/navigation";

/** Mine: session, watchlist folders, journal entry point. */
export default function MinePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserView | null>(null);
  const [checked, setChecked] = useState(false);
  const [folders, setFolders] = useState<WatchlistsResponse | null>(null);

  useEffect(() => {
    restoreSession();
    if (!signedIn()) {
      setChecked(true);
      return;
    }
    let live = true;
    me().then(async (u) => {
      if (!live) return;
      setUser(u);
      setChecked(true);
      if (u != null) {
        try {
          const w = await apiGet<WatchlistsResponse>("/watchlist");
          if (live) setFolders(w);
        } catch {
          /* watchlist stays empty; alerts still work */
        }
      }
    });
    return () => {
      live = false;
    };
  }, []);

  async function signOut() {
    await logout();
    router.push("/login");
  }

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

  const all = folders?.watchlists ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold">Mine</h1>
        <span className="text-sm text-muted">@{user.username}</span>
        <button
          type="button"
          onClick={signOut}
          className="ml-auto min-h-[36px] rounded-md border border-line px-3 text-sm font-medium text-muted hover:text-fg"
        >
          Sign out
        </button>
      </div>

      <section aria-label="Watchlists" className="overflow-hidden rounded-md border border-line bg-surface">
        <div className="flex items-baseline justify-between px-4 pt-3">
          <h2 className="text-sm font-semibold">Watchlists</h2>
          <Link href="/alerts" className="text-xs font-medium text-accent">
            Manage alerts →
          </Link>
        </div>
        {all.length === 0 ? (
          <EmptyState title="No watchlists yet — add stocks from any quote to start one." />
        ) : (
          all.map((f) => (
            <div key={f.id} className="border-t border-line px-4 py-2 first:border-t-0">
              <p className="tnum py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {f.name} · {f.stocks.length}
              </p>
              {f.stocks.length > 0 && (
                <DataTable
                  columns={[
                    {
                      key: "symbol",
                      header: "Symbol",
                      render: (s) => (
                        <Link href={`/stock/${s.tradingSymbol}`} className="font-medium hover:text-accent">
                          {s.tradingSymbol}
                        </Link>
                      ),
                    },
                    {
                      key: "ltp",
                      header: "LTP",
                      align: "right",
                      render: (s) => <span className="tnum">{s.ltp ?? "—"}</span>,
                    },
                    {
                      key: "pct",
                      header: "%",
                      align: "right",
                      render: (s) => <ChangePill value={s.pctChange} />,
                    },
                    {
                      key: "entry",
                      header: "Entry",
                      align: "right",
                      render: (s) => <span className="tnum text-muted">{s.entryPrice ?? "—"}</span>,
                    },
                    {
                      key: "target",
                      header: "Target",
                      align: "right",
                      render: (s) => <span className="tnum text-muted">{s.target1 ?? "—"}</span>,
                    },
                  ]}
                  rows={f.stocks}
                  rowKey={(s) => s.id}
                  loading={false}
                  empty={null}
                />
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
