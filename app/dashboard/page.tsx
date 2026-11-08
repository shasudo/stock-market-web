"use client";

import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { HoldingsResponse, MoodResponse, WatchlistsResponse } from "@/lib/types";
import { useSession } from "@/components/mine/session";
import { EmptyState } from "@/components/DataTable";
import { SessionGate } from "@/components/mine/session";
import { useEffect, useState } from "react";

interface AlertsPayload {
  alerts: unknown[];
}

/** Dashboard: your money, your lists, your rules — one glance. */
export default function DashboardPage() {
  const { user, checked } = useSession();
  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null);
  const [folders, setFolders] = useState<WatchlistsResponse | null>(null);
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [mood, setMood] = useState<MoodResponse | null>(null);

  useEffect(() => {
    if (!checked || user == null) return;
    let live = true;
    void apiGet<HoldingsResponse>("/portfolio-holdings").then((h) => live && setHoldings(h));
    void apiGet<WatchlistsResponse>("/watchlist").then((w) => live && setFolders(w));
    void apiGet<AlertsPayload>("/alerts")
      .then((a) => live && setAlertCount(a.alerts.length))
      .catch(() => live && setAlertCount(null));
    void apiGet<MoodResponse>("/market-data/mood-index").then((m) => live && setMood(m));
    return () => {
      live = false;
    };
  }, [checked, user]);

  const invested = (holdings?.holdings ?? []).reduce((s, h) => s + h.quantity * h.avgPrice, 0);
  const stocks = (folders?.watchlists ?? []).reduce((s, f) => s + f.stocks.length, 0);

  return (
    <SessionGate checked={checked} user={user} title="Dashboard">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
        <h1 className="px-1 text-base font-semibold">Dashboard</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/portfolio/holdings" className="rounded-md border border-line bg-surface px-4 py-3 hover:border-accent">
            <p className="tnum tnum-strong text-xl">
              {invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">invested</p>
          </Link>
          <Link href="/watchlist" className="rounded-md border border-line bg-surface px-4 py-3 hover:border-accent">
            <p className="tnum tnum-strong text-xl">{stocks}</p>
            <p className="text-xs text-muted">watched stocks</p>
          </Link>
          <Link href="/alerts" className="rounded-md border border-line bg-surface px-4 py-3 hover:border-accent">
            <p className="tnum tnum-strong text-xl">{alertCount ?? "—"}</p>
            <p className="text-xs text-muted">active alerts</p>
          </Link>
          <Link href="/market-mood" className="rounded-md border border-line bg-surface px-4 py-3 hover:border-accent">
            <p className="tnum tnum-strong text-xl">{mood?.score?.toFixed(0) ?? "—"}</p>
            <p className="text-xs text-muted">market mood</p>
          </Link>
        </div>
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            title="Deeper cuts live in their own terminals."
            action={
              <span className="flex flex-wrap justify-center gap-3 text-sm font-medium">
                <Link href="/portfolio" className="text-accent">
                  Portfolio
                </Link>
                <Link href="/markets" className="text-accent">
                  Markets
                </Link>
                <Link href="/fno" className="text-accent">
                  F&O
                </Link>
              </span>
            }
          />
        </div>
      </div>
    </SessionGate>
  );
}
