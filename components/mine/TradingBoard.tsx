"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ApiError } from "@/lib/types";
import type { EnrichedTrade, TradesResponse } from "@/lib/types";
import { Num } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { SessionGate, useSession } from "./session";

type Mode = "paper" | "live";
const CATEGORIES = ["intraday", "fno", "swing", "positional", "multibagger"] as const;

/** Trading board: open positions per mode, with compact ticket entry. */
export function TradingBoard({ mode, title, blurb }: { mode: Mode; title: string; blurb: string }) {
  const { user, checked } = useSession();
  const [trades, setTrades] = useState<EnrichedTrade[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<TradesResponse>(`/trades?mode=${mode}`)
      .then((t) => {
        if (live) {
          setTrades(t.trades);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [checked, user, mode, reload]);

  async function remove(id: string) {
    await apiDelete<unknown>("/trades", { id });
    setReload((n) => n + 1);
  }

  return (
    <SessionGate checked={checked} user={user} title={title}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline gap-2 px-1">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-xs text-muted">{blurb}</p>
        </div>
        <TicketForm mode={mode} onCreated={() => setReload((n) => n + 1)} />
        <section aria-label={title} className="overflow-hidden rounded-md border border-line bg-surface">
          <DataTable
            stickyFirst
            columns={[
              {
                key: "symbol",
                header: "Symbol",
                render: (t) => (
                  <span>
                    <Link href={`/stock/${t.tradingSymbol}`} className="font-medium hover:text-accent">
                      {t.tradingSymbol}
                    </Link>
                    {t.tradingType != null && (
                      <span className="tnum ml-2 text-[11px] font-normal capitalize text-faint">{t.tradingType}</span>
                    )}
                  </span>
                ),
              },
              {
                key: "qty",
                header: "Qty",
                align: "right",
                render: (t) => <span className="tnum text-muted">{t.quantity}</span>,
              },
              {
                key: "entry",
                header: "Entry",
                align: "right",
                render: (t) => <span className="tnum">{t.entryPrice ?? "—"}</span>,
              },
              {
                key: "ltp",
                header: "LTP",
                align: "right",
                render: (t) => <span className="tnum text-muted">{t.ltp ?? "—"}</span>,
              },
              {
                key: "sl",
                header: "SL",
                align: "right",
                render: (t) => <span className="tnum text-muted">{t.stopLoss ?? "—"}</span>,
              },
              {
                key: "tgt",
                header: "Tgt",
                align: "right",
                render: (t) => <span className="tnum text-muted">{t.target1 ?? "—"}</span>,
              },
              {
                key: "pnl",
                header: "P&L",
                align: "right",
                render: (t) =>
                  t.entryPrice == null || t.ltp == null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <Num value={(t.ltp - t.entryPrice) * t.quantity} />
                  ),
              },
              {
                key: "action",
                header: "",
                align: "right",
                render: (t) => (
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="min-h-[32px] rounded-md px-2 text-xs font-medium text-muted hover:text-down"
                  >
                    Close
                  </button>
                ),
              },
            ]}
            rows={trades ?? []}
            rowKey={(t) => t.id}
            loading={trades == null && !failed}
            empty={
              <EmptyState
                title={
                  failed ? "Positions are unreachable right now." : `No ${mode} positions — open a ticket above.`
                }
              />
            }
          />
          <div className="tnum border-t border-line px-4 py-2 text-xs text-muted">
            Open P&L{" "}
            <strong>
              {trades == null
                ? "—"
                : trades
                    .reduce((s, t) => s + (t.entryPrice != null && t.ltp != null ? (t.ltp - t.entryPrice) * t.quantity : 0), 0)
                    .toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </strong>
          </div>
        </section>
        <p className="px-1 text-[11px] text-faint">
          {mode === "paper" ? "Paper fills at LTP — no broker, no risk." : "Live book — reconcile with your broker."}
        </p>
      </div>
    </SessionGate>
  );
}

function TicketForm({ mode, onCreated }: { mode: Mode; onCreated: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [category, setCategory] = useState<string>("swing");
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const upper = symbol.trim().toUpperCase();
    const quantity = Number(qty);
    const entryPrice = Number(entry);
    if (upper === "" || !(quantity > 0) || !(entryPrice > 0)) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost<unknown>("/trades", {
        mode,
        tradingType: category,
        instrument: "EQ",
        tradingSymbol: upper,
        quantity,
        entryPrice,
      });
      setSymbol("");
      setQty("");
      setEntry("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open the position.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Symbol
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="RELIANCE"
          className="tnum h-10 w-32 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Style
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-line bg-bg px-2 text-sm text-fg outline-none focus:border-accent"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Qty
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          className="tnum h-10 w-24 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Entry ₹
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          inputMode="decimal"
          className="tnum h-10 w-28 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={busy || symbol.trim() === "" || !(Number(qty) > 0) || !(Number(entry) > 0)}
        className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Opening…" : "Open position"}
      </button>
      {error != null && (
        <p role="alert" className="w-full text-xs font-medium text-down">
          {error}
        </p>
      )}
    </form>
  );
}
