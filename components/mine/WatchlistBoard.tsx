"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ApiError } from "@/lib/types";
import type { WatchlistsResponse } from "@/lib/types";
import { ChangePill } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { SessionGate, useSession } from "./session";

/** Watchlist folders with stocks, levels and folder management. */
export function WatchlistBoard({ listType, title, blurb }: { listType: string; title: string; blurb: string }) {
  const { user, checked } = useSession();
  const [folders, setFolders] = useState<WatchlistsResponse | null>(null);

  const visible = (folders?.watchlists ?? [])
    .map((f) => ({ ...f, stocks: f.stocks.filter((s) => (s.listType ?? "normal") === listType) }))
    .filter((f) => f.stocks.length > 0 || f.isDefault);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [newFolder, setNewFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<WatchlistsResponse>("/watchlist")
      .then((w) => {
        if (live) {
          setFolders(w);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [checked, user, reload]);

  async function removeStock(id: string) {
    await apiDelete<unknown>("/watchlist", { stockId: id });
    setReload((n) => n + 1);
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolder.trim();
    if (name === "") return;
    setBusy(true);
    setFolderError(null);
    try {
      await apiPost<unknown>("/watchlist/folders", { name });
      setNewFolder("");
      setReload((n) => n + 1);
    } catch (err) {
      setFolderError(err instanceof ApiError ? err.message : "Could not create the folder.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(id: string) {
    await apiDelete<unknown>("/watchlist/folders", { id });
    setReload((n) => n + 1);
  }

  return (
    <SessionGate checked={checked} user={user} title={title}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline gap-2 px-1">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-xs text-muted">{blurb}</p>
        </div>

        <form onSubmit={createFolder} className="flex items-center gap-2">
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder name"
            aria-label="New folder name"
            maxLength={40}
            className="h-9 w-56 rounded-md border border-line bg-surface px-3 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || newFolder.trim() === ""}
            className="min-h-[36px] rounded-md border border-line bg-surface px-3 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add folder"}
          </button>
          {folderError != null && (
            <p role="alert" className="text-xs font-medium text-down">
              {folderError}
            </p>
          )}
        </form>

        {folders == null && !failed ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-5 w-2/3" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-md border border-line bg-surface">
            <EmptyState
              title={
                failed
                  ? "Watchlists are unreachable right now."
                  : listType === "preposition"
                    ? "No pre-position drafts — stage them from any quote."
                    : "No folders yet — create one above."
              }
            />
          </div>
        ) : (
          visible.map((f) => (
            <section
              key={f.id}
              aria-label={f.name}
              className="overflow-hidden rounded-md border border-line bg-surface"
            >
              <div className="flex items-center gap-2 px-4 pt-3">
                <h2 className="text-sm font-semibold">
                  {f.name}
                  <span className="tnum ml-2 text-xs font-normal text-faint">{f.stocks.length}</span>
                </h2>
                {!f.isDefault && (
                  <button
                    type="button"
                    onClick={() => deleteFolder(f.id)}
                    className="ml-auto min-h-[32px] rounded-md px-2 text-xs font-medium text-muted hover:text-down"
                  >
                    Delete folder
                  </button>
                )}
              </div>
              {f.stocks.length > 0 ? (
                <DataTable
                  stickyFirst
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
                      key: "sl",
                      header: "SL",
                      align: "right",
                      render: (s) => <span className="tnum text-muted">{s.stopLoss ?? "—"}</span>,
                    },
                    {
                      key: "target",
                      header: "Tgt",
                      align: "right",
                      render: (s) => <span className="tnum text-muted">{s.target1 ?? "—"}</span>,
                    },
                    {
                      key: "action",
                      header: "",
                      align: "right",
                      render: (s) => (
                        <button
                          type="button"
                          onClick={() => removeStock(s.id)}
                          className="min-h-[32px] rounded-md px-2 text-xs font-medium text-muted hover:text-down"
                        >
                          Remove
                        </button>
                      ),
                    },
                  ]}
                  rows={f.stocks}
                  rowKey={(s) => s.id}
                  loading={false}
                  empty={null}
                />
              ) : (
                <p className="px-4 py-3 text-xs text-faint">Empty — add stocks from any quote.</p>
              )}
            </section>
          ))
        )}

      </div>
    </SessionGate>
  );
}
