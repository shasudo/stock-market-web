"use client";

import type { Stock } from "@/lib/mockData";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  appleTableStyles,
  getChangeColorClasses,
  getGroupBadgeClasses,
} from "@/lib/table-styles";

interface StockTableProps {
  stocks: Stock[];
  type: "gainers" | "losers";
}

function TrendSparkline({ positive }: { positive: boolean }) {
  const points = positive
    ? "0,20 10,18 20,15 30,16 40,12 50,10 60,8 70,6 80,4 90,2 100,0"
    : "0,0 10,2 20,4 30,3 40,8 50,10 60,12 70,14 80,16 90,18 100,20";

  return (
    <div className="w-16 h-5" aria-hidden="true">
      <svg viewBox="0 0 100 20" className="w-full h-full">
        <polyline
          fill="none"
          stroke={positive ? "#059669" : "#e11d48"}
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
    <div className={appleTableStyles.container}>
      <div className={appleTableStyles.scrollWrapper}>
        <table className={appleTableStyles.table}>
          <thead className={appleTableStyles.thead}>
            <tr>
              <th className={appleTableStyles.thCenter}>#</th>
              <th className={appleTableStyles.th}>Company</th>
              <th className={appleTableStyles.th}>Sector</th>
              <th className={appleTableStyles.th}>Industry</th>
              <th className={appleTableStyles.thCenter}>Group</th>
              <th className={appleTableStyles.thCenter}>Face Value</th>
              <th className={appleTableStyles.th}>Price Band</th>
              <th className={appleTableStyles.th}>Mkt Cap</th>
              <th className={appleTableStyles.thRight}>Pre Close</th>
              <th className={appleTableStyles.thRight}>LTP</th>
              <th className={appleTableStyles.thRight}>Net Change</th>
              <th className={appleTableStyles.thRight}>% Change</th>
              <th className={appleTableStyles.thCenter}>Trend</th>
            </tr>
          </thead>
          <tbody className={appleTableStyles.tbody}>
            {stocks.map((stock, index) => {
              const change = getChangeColorClasses(stock.percentInChange);
              const TrendIcon =
                stock.percentInChange >= 0 ? TrendingUp : TrendingDown;
              return (
                <tr key={stock.sNo} className={appleTableStyles.row}>
                  {/* Position in the rendered list, so any filtering upstream
                    still numbers 1, 2, 3. */}
                  <td className={appleTableStyles.tdMuted}>{index + 1}</td>
                  <td className={appleTableStyles.tdBold}>{stock.company}</td>
                  <td className={appleTableStyles.tdMuted}>{stock.sector}</td>
                  <td className={appleTableStyles.tdMuted}>{stock.industry}</td>
                  <td className={appleTableStyles.td}>
                    <div className="flex justify-center">
                      <span className={getGroupBadgeClasses(stock.group)}>
                        {stock.group}
                      </span>
                    </div>
                  </td>
                  <td className={appleTableStyles.tdMuted}>
                    <div className="flex justify-center num-font">
                      ₹{stock.faceValue}
                    </div>
                  </td>
                  <td className={appleTableStyles.tdMuted}>
                    <span className={change.text}>{stock.priceBand}</span>
                  </td>
                  <td className={appleTableStyles.tdMuted}>
                    {stock.mktCapital}
                  </td>
                  <td className={appleTableStyles.tdMono}>
                    ₹{stock.preClose.toFixed(2)}
                  </td>
                  <td className={appleTableStyles.tdMono}>
                    ₹{stock.ltp.toFixed(2)}
                  </td>
                  <td className={appleTableStyles.tdMono}>
                    <span className={change.text}>
                      {stock.netChange >= 0 ? "+" : ""}₹
                      {stock.netChange.toFixed(2)}
                    </span>
                  </td>
                  <td className={appleTableStyles.tdMono}>
                    <div className="flex items-center justify-end">
                      <span className={change.pill}>
                        <TrendIcon className="w-3 h-3" aria-hidden="true" />
                        {stock.percentInChange >= 0 ? "+" : ""}
                        {stock.percentInChange.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className={appleTableStyles.td}>
                    <div className="flex justify-center">
                      <TrendSparkline positive={type === "gainers"} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
