"use client";

import Link from "next/link";
import type { ShareholdingResponse, StatementsResponse, UserView } from "@/lib/types";
import { DataStamp } from "../numbers";
import { DataTable, EmptyState } from "../DataTable";
import { useTerminalData } from "./useStockTerminal";
import { cn } from "@/lib/cn";

function Gate({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-line bg-surface">
      <EmptyState
        title={`Sign in to see ${label}.`}
        action={
          <Link href="/login" className="text-sm font-medium text-accent">
            Sign in
          </Link>
        }
      />
    </div>
  );
}

const HOLDER_COLS = ["promoters", "fiis", "diis", "government", "publicShare", "others"] as const;

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(2)}%`;
}

/** Holdings: promoter/FII/DII trajectory plus top holders. */
export function HoldingsTerminal({
  user,
  checked,
  symbol,
}: {
  user: UserView | null;
  checked: boolean;
  symbol: string;
}) {
  const { data, failed, loading, gated } = useTerminalData<ShareholdingResponse>(
    user, checked, `/stocks/${encodeURIComponent(symbol)}/shareholding`, 300_000,
  );
  if (gated) return <Gate label="shareholding" />;

  const quarters = [...(data?.quarters ?? [])]
    .sort((a, b) => b.asOfDate.localeCompare(a.asOfDate))
    .slice(0, 8);
  const holders = (data?.holders ?? []).slice(0, 20);
  const recent = quarters.map((q) => q.asOfDate.slice(0, 7)).filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Holder mix" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Holder mix</h2>
        <DataTable
          columns={[
            {
              key: "q",
              header: "Quarter",
              render: (q) => <span className="tnum text-muted">{q.asOfDate.slice(0, 7)}</span>,
            },
            ...HOLDER_COLS.map((c) => ({
              key: c,
              header: c === "fiis" ? "FII" : c === "diis" ? "DII" : c === "publicShare" ? "Public" : c[0]!.toUpperCase() + c.slice(1),
              align: "right" as const,
              render: (q: (typeof quarters)[number]) => <span className="tnum">{pct(q[c])}</span>,
            })),
          ]}
          rows={quarters}
          rowKey={(q) => q.asOfDate}
          loading={loading}
          empty={
            <EmptyState title={failed ? "Holdings are unreachable right now." : "No shareholding history."} />
          }
        />
      </section>
      <section aria-label="Top holders" className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">Top holders</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="sticky left-0 bg-surface px-3 py-2 text-xs font-semibold text-muted">Holder</th>
                {recent.map((r) => (
                  <th key={r} className="tnum whitespace-nowrap px-2 py-2 text-right text-xs font-semibold text-muted">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holders.map((h) => (
                <tr key={`${h.category}-${h.key}`} className="border-b border-line last:border-0">
                  <td className="sticky left-0 max-w-44 truncate bg-surface px-3 py-1.5" title={h.name}>
                    <span className="font-medium">{h.name}</span>
                    <span className="block text-[11px] capitalize text-faint">{h.category}</span>
                  </td>
                  {recent.map((r) => {
                    const match = Object.keys(h.values).find((k) => k.startsWith(r));
                    return (
                      <td key={r} className="tnum whitespace-nowrap px-2 py-1.5 text-right text-muted">
                        {match == null ? "—" : pct(h.values[match])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {holders.length === 0 && !loading && (
            <EmptyState title="No holder breakdown in this window." />
          )}
        </div>
      </section>
    </div>
  );
}

const INCOME_ORDER = [
  "totalRevenue",
  "costOfRevenue",
  "grossProfit",
  "totalExpenses",
  "EBITDA",
  "EBIT",
  "pretaxIncome",
  "taxProvision",
  "netIncome",
];

function stmtRows(rows: { date: string; values: Record<string, number | null> }[]): {
  dates: string[];
  keys: string[];
  byKey: Map<string, Array<number | null>>;
} {
  const dates = rows.map((r) => r.date);
  const keySet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r.values)) keySet.add(k);
  const keys = [
    ...INCOME_ORDER.filter((k) => keySet.has(k)),
    ...[...keySet].filter((k) => !INCOME_ORDER.includes(k)).sort(),
  ];
  const byKey = new Map<string, Array<number | null>>();
  for (const k of keys) byKey.set(k, rows.map((r) => r.values[k] ?? null));
  return { dates, keys, byKey };
}

function money(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e7) return `${(v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
  return v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Financials: annual and quarterly income, balance sheet and cash flow. */
export function FinancialsTerminal({
  user,
  checked,
  symbol,
}: {
  user: UserView | null;
  checked: boolean;
  symbol: string;
}) {
  const { data, failed, loading, gated } = useTerminalData<StatementsResponse>(
    user, checked, `/stocks/${encodeURIComponent(symbol)}/statements`, 300_000,
  );
  if (gated) return <Gate label="financial statements" />;

  const annual = data?.annual ?? { income: [], balance: [], cash: [] };
  const quarterly = data?.quarterly ?? { income: [], balance: [], cash: [] };

  function stmt(title: string, rows: { date: string; values: Record<string, number | null> }[]) {
    if (rows.length === 0) return null;
    const { dates, keys, byKey } = stmtRows(rows);
    return (
      <section aria-label={title} className="overflow-hidden rounded-md border border-line bg-surface">
        <h2 className="px-4 pt-3 text-sm font-semibold">{title}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="sticky left-0 bg-surface px-3 py-2 text-xs font-semibold text-muted">Line</th>
                {dates.map((d) => (
                  <th key={d} className="tnum whitespace-nowrap px-2 py-2 text-right text-xs font-semibold text-muted">
                    {d.slice(0, 7)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k} className={cn("border-b border-line last:border-0", INCOME_ORDER.slice(0, 3).includes(k) && "bg-bg")}>
                  <td className="sticky left-0 bg-surface px-3 py-1.5 font-medium">{k}</td>
                  {(byKey.get(k) ?? []).map((v, i) => (
                    <td key={i} className="tnum whitespace-nowrap px-2 py-1.5 text-right text-muted">
                      {money(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-6" aria-label="Loading">
          <div className="skeleton h-5 w-full" />
          <div className="skeleton h-5 w-2/3" />
        </div>
      ) : failed || (annual.income.length === 0 && quarterly.income.length === 0) ? (
        <div className="rounded-md border border-line bg-surface">
          <EmptyState
            title={failed ? "Statements are unreachable right now." : "No statements filed in this window."}
          />
        </div>
      ) : (
        <>
          {stmt("Annual P&L", annual.income)}
          {stmt("Quarterly P&L", quarterly.income)}
          {stmt("Balance sheet", annual.balance)}
          {stmt("Cash flow", annual.cash)}
          <DataStamp label={null} />
        </>
      )}
    </div>
  );
}
