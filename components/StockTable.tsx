"use client";

import type { Stock } from "@/lib/mockData";
import {
  DsTableContainer,
  DsTableScroll,
  DsTable,
  DsTableHeader,
  DsTableBody,
  DsRow,
  DsHead,
  DsCell,
  DsNumCell,
  ChangePill,
  ChangeText,
  DsBadge,
} from "@/components/ds";

interface StockTableProps {
  stocks: Stock[];
  type: "gainers" | "losers";
}

function TrendSparkline({ positive }: { positive: boolean }) {
  const points = positive
    ? "0,20 10,18 20,15 30,16 40,12 50,10 60,8 70,6 80,4 90,2 100,0"
    : "0,0 10,2 20,4 30,3 40,8 50,10 60,12 70,14 80,16 90,18 100,20";

  return (
    <div
      className={
        positive
          ? "h-5 w-16 text-emerald-700 dark:text-emerald-300"
          : "h-5 w-16 text-rose-700 dark:text-rose-300"
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 20" className="h-full w-full">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
          points={points}
        />
      </svg>
    </div>
  );
}

export default function StockTable({ stocks, type }: StockTableProps) {
  return (
    <DsTableContainer>
      <DsTableScroll>
        <DsTable>
          <DsTableHeader>
            <DsRow>
              <DsHead align="center">#</DsHead>
              <DsHead>Company</DsHead>
              <DsHead>Sector</DsHead>
              <DsHead>Industry</DsHead>
              <DsHead align="center">Group</DsHead>
              <DsHead align="center">Face Value</DsHead>
              <DsHead>Price Band</DsHead>
              <DsHead>Mkt Cap</DsHead>
              <DsHead align="right">Pre Close</DsHead>
              <DsHead align="right">LTP</DsHead>
              <DsHead align="right">Net Change</DsHead>
              <DsHead align="right">% Change</DsHead>
              <DsHead align="center">Trend</DsHead>
            </DsRow>
          </DsTableHeader>
          <DsTableBody>
            {stocks.map((stock, index) => (
              <DsRow key={stock.sNo}>
                {/* Position in the rendered list, so any filtering upstream
                    still numbers 1, 2, 3. */}
                <DsCell align="center" className="text-muted-foreground">
                  {index + 1}
                </DsCell>
                <DsCell className="font-semibold">{stock.company}</DsCell>
                <DsCell className="text-muted-foreground">{stock.sector}</DsCell>
                <DsCell className="text-muted-foreground">{stock.industry}</DsCell>
                <DsCell align="center">
                  <DsBadge>{stock.group}</DsBadge>
                </DsCell>
                <DsCell align="center" className="text-muted-foreground tabular-nums">
                  ₹{stock.faceValue}
                </DsCell>
                <DsCell className="text-muted-foreground">
                  <ChangeText value={stock.percentInChange}>{stock.priceBand}</ChangeText>
                </DsCell>
                <DsCell className="text-muted-foreground">{stock.mktCapital}</DsCell>
                <DsNumCell className="text-muted-foreground">
                  ₹{stock.preClose.toFixed(2)}
                </DsNumCell>
                <DsNumCell>₹{stock.ltp.toFixed(2)}</DsNumCell>
                <DsNumCell>
                  <ChangeText value={stock.netChange}>
                    {stock.netChange >= 0 ? "+" : ""}₹{stock.netChange.toFixed(2)}
                  </ChangeText>
                </DsNumCell>
                <DsNumCell>
                  <div className="flex items-center justify-end">
                    <ChangePill value={stock.percentInChange} />
                  </div>
                </DsNumCell>
                <DsCell align="center">
                  <div className="flex justify-center">
                    <TrendSparkline positive={type === "gainers"} />
                  </div>
                </DsCell>
              </DsRow>
            ))}
          </DsTableBody>
        </DsTable>
      </DsTableScroll>
    </DsTableContainer>
  );
}
