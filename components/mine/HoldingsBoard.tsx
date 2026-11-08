"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ApiError } from "@/lib/types";
import type { HoldingItem, HoldingsResponse } from "@/lib/types";
import { DataTable, EmptyState } from "../DataTable";
import { SessionGate, useSession } from "./session";

/** Holdings: delivery book with average-price math. */
export function HoldingsBoard() {
  const { user, checked } = useSession();
  const [holdings, setHoldings] = useState<HoldingItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<HoldingsResponse>("/portfolio-holdings")
      .then((h) => {
        if (live) {
          setHoldings(h.holdings);
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

  async function remove(id: string) {
    await apiDelete<unknown>("/portfolio-holdings", { id });
    setReload((n) => n + 1);
  }

  const invested = (holdings ?? []).reduce((s, h) => s + h.quantity * h.avgPrice, 0);

  return (
    <SessionGate checked={checked} user={user} title="Holdings">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline gap-2 px-1">
          <h1 className="text-base font-semibold">Holdings</h1>
          <p className="tnum text-xs text-muted">
            {holdings?.length ?? 0} lines ·{" "}
            {invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })} invested
          </p>
        </div>
        <AddHoldingForm onCreated={() => setReload((n) => n + 1)} />
        <section aria-label="Holdings" className="overflow-hidden rounded-md border border-line bg-surface">
          <DataTable
            stickyFirst
            columns={[
              {
                key: "symbol",
                header: "Symbol",
                render: (h) => (
                  <span>
                    <Link href={`/stock/${h.tradingSymbol}`} className="font-medium hover:text-accent">
                      {h.tradingSymbol}
                    </Link>
                    {h.displayName != null && (
                      <span className="tnum ml-2 hidden text-[11px] font-normal text-faint lg:inline">
                        {h.displayName}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                key: "qty",
                header: "Qty",
                align: "right",
                render: (h) => <span className="tnum text-muted">{h.quantity}</span>,
              },
              {
                key: "avg",
                header: "Avg",
                align: "right",
                render: (h) => <span className="tnum">{h.avgPrice}</span>,
              },
              {
                key: "cost",
                header: "Cost",
                align: "right",
                render: (h) => (
                  <span className="tnum tnum-strong">
                    {(h.quantity * h.avgPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                ),
              },
              {
                key: "action",
                header: "",
                align: "right",
                render: (h) => (
                  <button
                    type="button"
                    onClick={() => remove(h.id)}
                    className="min-h-[32px] rounded-md px-2 text-xs font-medium text-muted hover:text-down"
                  >
                    Remove
                  </button>
                ),
              },
            ]}
            rows={holdings ?? []}
            rowKey={(h) => h.id}
            loading={holdings == null && !failed}
            empty={
              <EmptyState
                title={failed ? "Holdings are unreachable right now." : "No holdings — log your first buy above."}
              />
            }
          />
        </section>
      </div>
    </SessionGate>
  );
}

function AddHoldingForm({ onCreated }: { onCreated: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const upper = symbol.trim().toUpperCase();
    const quantity = Number(qty);
    const avgPrice = Number(avg);
    if (upper === "" || !(quantity > 0) || !(avgPrice > 0)) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost<unknown>("/portfolio-holdings", {
        tradingSymbol: upper,
        displayName: upper,
        quantity,
        avgPrice,
      });
      setSymbol("");
      setQty("");
      setAvg("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log the holding.");
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
        Qty
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          className="tnum h-10 w-24 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Avg ₹
        <input
          value={avg}
          onChange={(e) => setAvg(e.target.value)}
          inputMode="decimal"
          className="tnum h-10 w-28 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={busy || symbol.trim() === "" || !(Number(qty) > 0) || !(Number(avg) > 0)}
        className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Logging…" : "Log buy"}
      </button>
      {error != null && (
        <p role="alert" className="w-full text-xs font-medium text-down">
          {error}
        </p>
      )}
    </form>
  );
}
