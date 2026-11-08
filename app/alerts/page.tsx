"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { me, restoreSession, signedIn } from "@/lib/auth";
import type { AlertDirection, AlertView, UserView } from "@/lib/types";
import { inr } from "@/lib/format";
import { DataTable, EmptyState } from "@/components/DataTable";
import { cn } from "@/lib/cn";

interface AlertsPayload {
  alerts: AlertView[];
}

/** Alerts: price-target rules. Firing is evaluated server-side on every read. */
export default function AlertsPage() {
  const [user, setUser] = useState<UserView | null>(null);
  const [checked, setChecked] = useState(false);
  const [alerts, setAlerts] = useState<AlertView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

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
      if (u == null) return;
      try {
        const payload = await apiGet<AlertsPayload>("/alerts");
        if (live) {
          setAlerts(payload.alerts);
          setFailed(false);
        }
      } catch {
        if (live) setFailed(true);
      }
    });
    return () => {
      live = false;
    };
  }, [reload]);

  async function remove(id: string) {
    await apiDelete<unknown>("/alerts", { id });
    setReload((n) => n + 1);
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <h1 className="px-1 text-base font-semibold">Alerts</h1>
      <CreateForm onCreated={() => setReload((n) => n + 1)} />
      <section aria-label="Alert rules" className="overflow-hidden rounded-md border border-line bg-surface">
        <DataTable
          stickyFirst
          columns={[
            {
              key: "symbol",
              header: "Symbol",
              render: (a) => (
                <Link href={`/stock/${a.tradingSymbol}`} className="font-medium hover:text-accent">
                  {a.tradingSymbol}
                </Link>
              ),
            },
            {
              key: "rule",
              header: "Rule",
              align: "right",
              render: (a) => (
                <span className="tnum">
                  {a.direction === "above" ? "≥" : "≤"} {inr(a.targetPrice)}
                </span>
              ),
            },
            {
              key: "ltp",
              header: "LTP",
              align: "right",
              render: (a) => <span className="tnum text-muted">{a.ltp == null ? "—" : inr(a.ltp)}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (a) => (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    a.status === "triggered" ? "bg-up-tint text-up" : "bg-accent/10 text-accent",
                  )}
                >
                  {a.status === "triggered" ? "triggered" : "watching"}
                </span>
              ),
            },
            {
              key: "action",
              header: "",
              align: "right",
              render: (a) => (
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="min-h-[32px] rounded-md px-2 text-xs font-medium text-muted hover:text-down"
                >
                  Delete
                </button>
              ),
            },
          ]}
          rows={alerts ?? []}
          rowKey={(a) => a.id}
          loading={alerts == null && !failed}
          empty={
            <EmptyState
              title={failed ? "Could not load alerts — the server is unreachable." : "No alerts — set a target above."}
            />
          }
        />
      </section>
      <p className="px-1 text-[11px] text-faint">
        Watching {alerts?.filter((a) => a.status !== "triggered").length ?? 0} · triggered rules are read-only;
        delete one to set a new target.
      </p>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<AlertDirection>("above");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const upper = symbol.trim().toUpperCase();
    const price = Number(target);
    if (upper === "" || !(price > 0)) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost<unknown>("/alerts", {
        tradingSymbol: upper,
        displayName: upper,
        targetPrice: price,
        direction,
        source: "others",
        category: "swing",
      });
      setSymbol("");
      setTarget("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the alert.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3"
    >
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
        Direction
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as AlertDirection)}
          className="h-10 rounded-md border border-line bg-bg px-2 text-sm text-fg outline-none focus:border-accent"
        >
          <option value="above">≥ rises to</option>
          <option value="below">≤ falls to</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Target ₹
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="tnum h-10 w-28 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
      <button
        type="submit"
        disabled={busy || symbol.trim() === "" || !(Number(target) > 0)}
        className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy ? "Adding…" : "Add alert"}
      </button>
      {error != null && (
        <p role="alert" className="w-full text-xs font-medium text-down">
          {error}
        </p>
      )}
    </form>
  );
}
