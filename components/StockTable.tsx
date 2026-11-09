"use client";

import { Stock } from "@/lib/mockData";
import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface StockTableProps {
  stocks: Stock[];
  type: "gainers" | "losers";
}

function TrendSparkline({ positive }: { positive: boolean }) {
  const points = positive
    ? "0,20 10,18 20,15 30,16 40,12 50,10 60,8 70,6 80,4 90,2 100,0"
    : "0,0 10,2 20,4 30,3 40,8 50,10 60,12 70,14 80,16 90,18 100,20";

  return (
    <div className="w-16 h-5">
      <svg viewBox="0 0 100 20" className="w-full h-full">
        <polyline
          fill="none"
          stroke={positive ? "#10b981" : "#ef4444"}
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  );
}

export default function StockTable({ stocks, type }: StockTableProps) {
  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden shadow-luxury">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                #
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Company
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sector
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Industry
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Group
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Face Value
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Price Band
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Mkt Cap
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pre Close
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                LTP
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Net Change
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                % Change
              </th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stocks.map((stock, index) => (
              <motion.tr
                key={stock.sNo}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="hover:bg-secondary/50 transition-colors group"
              >
                {/* Position in the rendered list, so any filtering upstream
                    still numbers 1, 2, 3. */}
                <td className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                  {index + 1}
                </td>
                <td className="px-2 py-1.5">
                  <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {stock.company}
                  </div>
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {stock.sector}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {stock.industry}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-center">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary border border-border text-foreground">
                      {stock.group}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    ₹{stock.faceValue}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-xs font-semibold whitespace-nowrap">
                  <span
                    className={
                      stock.netChange >= 0 ? "text-success" : "text-error"
                    }
                  >
                    {stock.priceBand}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                  {stock.mktCapital}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground text-right font-mono">
                  ₹{stock.preClose.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-xs font-semibold text-foreground text-right font-mono">
                  ₹{stock.ltp.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-xs text-right font-mono">
                  <span
                    className={`font-semibold ${
                      stock.netChange >= 0 ? "text-success" : "text-error"
                    }`}
                  >
                    {stock.netChange >= 0 ? "+" : ""}₹
                    {stock.netChange.toFixed(2)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex items-center justify-end">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono ${
                        stock.percentInChange >= 0
                          ? "bg-success/10 text-success"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      {stock.percentInChange >= 0 ? (
                        <TrendingUp className="w-3 h-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-0.5" />
                      )}
                      {stock.percentInChange >= 0 ? "+" : ""}
                      {stock.percentInChange.toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-center">
                    <TrendSparkline positive={type === "gainers"} />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
