import Link from "next/link";
import { int } from "@/lib/format";
import type { StockQuote } from "@/lib/types";
import { ChangePill, Num } from "./numbers";
import { DataTable, type Column } from "./DataTable";

/** The one stock table of the terminal. Company, LTP, change, volume, ranges. */
export function stockColumns(): Array<Column<StockQuote>> {
  return [
    {
      key: "company",
      header: "Company",
      render: (s) => (
        <Link href={`/stock/${s.tradingSymbol}`} className="font-medium hover:text-accent">
          {s.companyName}
          <span className="tnum ml-2 text-[11px] font-normal text-faint">{s.tradingSymbol}</span>
        </Link>
      ),
    },
    {
      key: "ltp",
      header: "LTP",
      align: "right",
      render: (s) => <span className="tnum tnum-strong">{s.cmp == null ? "—" : s.cmp}</span>,
    },
    {
      key: "chg",
      header: "Chg",
      align: "right",
      render: (s) => <Num value={s.netChange} />,
    },
    {
      key: "pct",
      header: "%",
      align: "right",
      render: (s) => <ChangePill value={s.percentChange} />,
    },
    {
      key: "vol",
      header: "Vol",
      align: "right",
      render: (s) => <span className="tnum text-muted">{int(s.volume)}</span>,
    },
    {
      key: "w52h",
      header: "52W H",
      align: "right",
      render: (s) => <span className="tnum text-muted">{s.week52High == null ? "—" : int(s.week52High)}</span>,
    },
    {
      key: "w52l",
      header: "52W L",
      align: "right",
      render: (s) => <span className="tnum text-muted">{s.week52Low == null ? "—" : int(s.week52Low)}</span>,
    },
    {
      key: "cap",
      header: "Mkt cap",
      align: "right",
      render: (s) => <span className="tnum text-muted">{s.marketCap ?? "—"}</span>,
    },
  ];
}

export function StockTable({
  rows,
  loading,
  empty,
  stamp,
}: {
  rows: StockQuote[];
  loading: boolean;
  empty: React.ReactNode;
  stamp?: React.ReactNode;
}) {
  return (
    <section aria-label="Stocks" className="overflow-hidden rounded-md border border-line bg-surface">
      <DataTable
        stickyFirst
        columns={stockColumns()}
        rows={rows}
        rowKey={(s) => s.tradingSymbol}
        loading={loading}
        empty={empty}
      />
      {stamp}
    </section>
  );
}
