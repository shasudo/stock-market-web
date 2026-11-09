"use client";

import { useMemo } from "react";
import {
  buildBalanceSheetTable,
  buildCashFlowTable,
  buildGrowthSummary,
  buildProfitLossTable,
  buildQuarterlyTable,
  buildRatiosTable,
  type GrowthSummary,
  type StatementTable,
} from "@/lib/fundamentals/statement-tables";
import type { FinancialStatementPeriod } from "@/lib/fundamentals/types";
import type { PriceHistoryPoint } from "@/lib/fundamentals/quick-ratios";
import { fmtCell, fmtPct } from "./summary-format";

export interface StatementsPayload {
  readonly annual: {
    readonly income: readonly FinancialStatementPeriod[];
    readonly balance: readonly FinancialStatementPeriod[];
    readonly cash: readonly FinancialStatementPeriod[];
  };
  readonly quarterly: {
    readonly income: readonly FinancialStatementPeriod[];
  };
  readonly sharesOutstanding: number | null;
  readonly price: number | null;
  readonly history: readonly PriceHistoryPoint[];
}

function StatementTableView({ table }: { table: StatementTable }) {
  if (table.periods.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No statement data available for this company yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-card px-3 py-2 text-left font-semibold text-muted-foreground" />
            {table.periods.map((period) => (
              <th
                key={period}
                className="whitespace-nowrap px-3 py-2 text-right font-semibold text-muted-foreground"
              >
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key} className="border-b border-border hover:bg-muted">
              <td className="sticky left-0 bg-card px-3 py-2 font-medium text-muted-foreground">
                {row.label}
              </td>
              {row.values.map((value, i) => (
                <td
                  key={`${row.key}-${table.periods[i]}`}
                  className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground"
                >
                  {fmtCell(row.kind, row.key, value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrowthBoxes({ summary }: { summary: GrowthSummary }) {
  const boxes: readonly {
    title: string;
    rows: readonly [string, number | null][];
  }[] = [
    {
      title: "Compounded Sales Growth",
      rows: [
        ["10 Years", summary.salesGrowth10y],
        ["5 Years", summary.salesGrowth5y],
        ["3 Years", summary.salesGrowth3y],
        ["TTM", summary.salesGrowthTtm],
      ],
    },
    {
      title: "Compounded Profit Growth",
      rows: [
        ["10 Years", summary.profitGrowth10y],
        ["5 Years", summary.profitGrowth5y],
        ["3 Years", summary.profitGrowth3y],
        ["TTM", summary.profitGrowthTtm],
      ],
    },
    {
      title: "Stock Price CAGR",
      rows: [
        ["10 Years", summary.priceCagr10y],
        ["5 Years", summary.priceCagr5y],
        ["3 Years", summary.priceCagr3y],
        ["1 Year", summary.priceCagr1y],
      ],
    },
    {
      title: "Return on Equity",
      rows: [
        ["10 Years", summary.roe10y],
        ["5 Years", summary.roe5y],
        ["3 Years", summary.roe3y],
        ["Last Year", summary.roeLast],
      ],
    },
  ];
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {boxes.map((box) => (
        <div
          key={box.title}
          className="rounded-xl border border-border bg-muted/60 p-3"
        >
          <p className="mb-2 text-xs font-bold text-foreground">{box.title}</p>
          {box.rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between py-0.5 text-xs"
            >
              <span className="text-muted-foreground">{label}:</span>
              <span className="font-semibold tabular-nums text-foreground">
                {value === null ? "—" : fmtPct(value, 0)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border/90 bg-card p-4 shadow-xs md:p-5"
    >
      <div className="mb-3 flex items-baseline gap-2 flex-wrap">
        <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
        {subtitle ? (
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StatementsSections({
  payload,
}: {
  payload: StatementsPayload | null;
}) {
  const tables = useMemo(() => {
    if (!payload) return null;
    const quarterly = buildQuarterlyTable(
      payload.quarterly.income,
      payload.sharesOutstanding,
    );
    const profitLoss = buildProfitLossTable(
      payload.annual.income,
      payload.sharesOutstanding,
    );
    const balance = buildBalanceSheetTable(payload.annual.balance);
    const cashFlow = buildCashFlowTable(
      payload.annual.cash,
      payload.annual.income,
    );
    const ratios = buildRatiosTable({
      income: payload.annual.income,
      balance: payload.annual.balance,
      cash: payload.annual.cash,
      shares: payload.sharesOutstanding,
      history: payload.history,
    });
    const growth = buildGrowthSummary({
      annualIncome: payload.annual.income,
      annualBalance: payload.annual.balance,
      quarterlyIncome: payload.quarterly.income,
      history: payload.history,
      price: payload.price,
    });
    return { quarterly, profitLoss, balance, cashFlow, ratios, growth };
  }, [payload]);

  if (!payload) {
    return (
      <Section id="quarters" title="Quarterly Results">
        <p className="py-6 text-center text-xs text-muted-foreground">
          Statement data is loading…
        </p>
      </Section>
    );
  }

  if (!tables) return null;
  const subtitle = "Consolidated Figures in Rs. Crores";

  return (
    <div className="space-y-6">
      <Section id="quarters" title="Quarterly Results" subtitle={subtitle}>
        <StatementTableView table={tables.quarterly} />
      </Section>
      <Section id="profit-loss" title="Profit & Loss" subtitle={subtitle}>
        <StatementTableView table={tables.profitLoss} />
        <GrowthBoxes summary={tables.growth} />
      </Section>
      <Section id="balance-sheet" title="Balance Sheet" subtitle={subtitle}>
        <StatementTableView table={tables.balance} />
      </Section>
      <Section id="cash-flow" title="Cash Flows" subtitle={subtitle}>
        <StatementTableView table={tables.cashFlow} />
      </Section>
      <Section id="ratios" title="Ratios" subtitle="Consolidated">
        <StatementTableView table={tables.ratios} />
      </Section>
    </div>
  );
}
