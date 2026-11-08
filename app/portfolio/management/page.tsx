"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api";
import { ApiError } from "@/lib/types";
import type { PortfolioFull } from "@/lib/types";
import { DataStamp } from "@/components/numbers";
import { DataTable, EmptyState } from "@/components/DataTable";
import { SessionGate, useSession } from "@/components/mine/session";

const CONDITIONS = ["Bull Market", "Bullish to Bearish", "Side Ways Market", "Bear Market", "Bearish to Bullish"];

function inr0(v: number): string {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Portfolio management: capital, regime, strategy allocations, experience notes. */
export default function ManagementPage() {
  const { user, checked } = useSession();
  const [portfolio, setPortfolio] = useState<PortfolioFull | null>(null);
  const [failed, setFailed] = useState(false);
  const [failedStatus, setFailedStatus] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [condition, setCondition] = useState("");
  const [capital, setCapital] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    apiGet<{ portfolio: PortfolioFull }>("/portfolio")
      .then((p) => {
        if (!live) return;
        setPortfolio(p.portfolio);
        setFailed(false);
        setFailedStatus(null);
      })
      .catch((err) => {
        if (!live) return;
        setFailed(true);
        setFailedStatus(err instanceof ApiError ? err.status : null);
      });
    return () => {
      live = false;
    };
  }, [checked, user, reload]);

  useEffect(() => {
    if (portfolio != null && condition === "" && capital === "") {
      setCondition(portfolio.marketCondition);
      setCapital(String(portfolio.totalCapital));
    }
  }, [portfolio, condition, capital]);

  async function createStarter() {
    setBusy(true);
    setError(null);
    try {
      await apiPut<unknown>("/portfolio", {
        marketCondition: "Side Ways Market",
        totalCapital: 0,
        strategies: [
          { name: "General", allocationPercent: 100, allocationRupees: 0, usedFunds: 0, unusedFunds: 0 },
        ],
        experienceNotes: [],
      });
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (portfolio == null) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiPut<unknown>("/portfolio", {
        marketCondition: condition,
        totalCapital: Number(capital),
        strategies: portfolio.strategies.map((s) => ({
          name: s.name,
          allocationPercent: s.allocationPercent,
          allocationRupees: s.allocationRupees,
          usedFunds: s.usedFunds,
          unusedFunds: s.unusedFunds,
        })),
        experienceNotes: portfolio.experienceNotes.map((n) => ({ positive: n.positive, negative: n.negative })),
      });
      setSaved(true);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the plan.");
    } finally {
      setBusy(false);
    }
  }

  const strategies = portfolio?.strategies ?? [];
  const allocated = strategies.reduce((s, x) => s + x.allocationPercent, 0);

  return (
    <SessionGate checked={checked} user={user} title="Portfolio plan">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
        <div className="flex flex-wrap items-baseline gap-2 px-1">
          <h1 className="text-base font-semibold">Portfolio plan</h1>
          <p className="text-xs text-muted">Capital, regime and strategy splits.</p>
        </div>

        {portfolio == null && !failed ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
            <div className="skeleton h-5 w-full" />
          </div>
        ) : portfolio == null ? (
          <div className="rounded-md border border-line bg-surface">
            <EmptyState
              title={
                failedStatus != null && failedStatus >= 400 && failedStatus < 500
                  ? "No plan yet — create a starter and shape it."
                  : "The plan is unreachable right now."
              }
              action={
                failedStatus != null && failedStatus >= 400 && failedStatus < 500 ? (
                  <button
                    type="button"
                    onClick={() => createStarter()}
                    className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white"
                  >
                    Create starter plan
                  </button>
                ) : undefined
              }
            />
            {error != null && (
              <p role="alert" className="px-4 pb-3 text-xs font-medium text-down">
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Regime
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="h-10 rounded-md border border-line bg-bg px-2 text-sm text-fg outline-none focus:border-accent"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Capital ₹
                <input
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                  inputMode="decimal"
                  className="tnum h-10 w-36 rounded-md border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={busy || condition === "" || !(Number(capital) >= 0)}
                className="min-h-[40px] rounded-md bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save plan"}
              </button>
              {error != null && (
                <p role="alert" className="w-full text-xs font-medium text-down">
                  {error}
                </p>
              )}
              {saved && <p className="w-full text-xs font-medium text-up">Saved.</p>}
            </form>

            <section aria-label="Strategies" className="overflow-hidden rounded-md border border-line bg-surface">
              <div className="flex items-baseline justify-between px-4 pt-3">
                <h2 className="text-sm font-semibold">Strategies</h2>
                <span className="tnum text-xs text-muted">{allocated.toFixed(1)}% allocated</span>
              </div>
              <DataTable
                columns={[
                  {
                    key: "name",
                    header: "Strategy",
                    render: (s) => <span className="font-medium">{s.name}</span>,
                  },
                  {
                    key: "pct",
                    header: "%",
                    align: "right",
                    render: (s) => <span className="tnum">{s.allocationPercent.toFixed(1)}</span>,
                  },
                  {
                    key: "inr",
                    header: "₹",
                    align: "right",
                    render: (s) => <span className="tnum text-muted">{inr0(s.allocationRupees)}</span>,
                  },
                  {
                    key: "used",
                    header: "Used",
                    align: "right",
                    render: (s) => <span className="tnum text-muted">{inr0(s.usedFunds)}</span>,
                  },
                ]}
                rows={strategies}
                rowKey={(s) => s.id}
                loading={false}
                empty={null}
              />
              <DataStamp label={portfolio.updatedAt} />
            </section>

            {(portfolio.experienceNotes ?? []).length > 0 && (
              <section aria-label="Experience notes" className="rounded-md border border-line bg-surface px-4 py-3">
                <h2 className="text-sm font-semibold">Experience notes</h2>
                <ul className="mt-1 flex flex-col gap-2">
                  {portfolio.experienceNotes.map((n) => (
                    <li key={n.id} className="text-[13px] text-muted">
                      {n.positive != null && <p>+ {n.positive}</p>}
                      {n.negative != null && <p>− {n.negative}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </SessionGate>
  );
}
