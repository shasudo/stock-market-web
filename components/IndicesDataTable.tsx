"use client";

import React, { useState } from "react";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";
import { getChangeColorClasses, appleTableStyles } from "@/lib/table-styles";

export interface IndexData {
  name: string;
  current: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  indicativeClose: number | null;
  prevClose: number;
  prevDay: number | null;
  oneWeekAgo: number | null;
  oneMonthAgo: number | null;
  oneYearAgo: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface IndicesDataTableProps {
  title: string;
  data: IndexData[];
  streaming: boolean;
  onStreamingChange: (streaming: boolean) => void;
}

const formatNumber = (num: number | null): string => {
  if (num === null || num === undefined) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getDateLabel = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const day = date.getDate().toString().padStart(2, "0");
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function IndicesDataTable({
  title,
  data,
  streaming,
  onStreamingChange,
}: IndicesDataTableProps) {
  const [search, setSearch] = useState("");

  const visibleData = data.filter((index) => matchesSearch(search, index.name));

  return (
    <div className={appleTableStyles.container}>
      {/* Title & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 bg-muted/80 border-b border-border/90">
        <span className="text-foreground font-bold text-xs md:text-sm tracking-tight">
          {title} ({visibleData.length})
        </span>
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search index..."
            className="relative w-48"
            inputClassName="w-full rounded-xl border border-border/90 bg-card py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:ring-1 focus:ring-ring/30 focus:outline-none shadow-xs"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">
              Live
            </span>
            {/* iOS Style Switch */}
            <button
              onClick={() => onStreamingChange(!streaming)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                streaming ? "bg-[#34C759]" : "bg-black/[0.12]"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow-xs transition-transform ${
                  streaming ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className={appleTableStyles.scrollWrapper}>
        <table className={appleTableStyles.table}>
          <thead className={appleTableStyles.thead}>
            <tr>
              <th className="px-4 py-3.5 text-[11px] font-bold text-foreground uppercase tracking-[0.06em] min-w-[160px] select-none">
                Index
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-foreground uppercase tracking-[0.06em] text-right min-w-[100px] select-none">
                Current
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-foreground uppercase tracking-[0.06em] text-right min-w-[80px] select-none">
                % Change
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[90px] select-none">
                Open
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[90px] select-none">
                High
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[90px] select-none">
                Low
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[90px] select-none">
                Prev Close
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[100px] select-none">
                <div>Prev Day</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  {getDateLabel(1)}
                </div>
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[100px] select-none">
                <div>1W Ago</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  {getDateLabel(7)}
                </div>
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[100px] select-none">
                <div>1M Ago</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  {getDateLabel(30)}
                </div>
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[100px] select-none">
                <div>1Y Ago</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  {getDateLabel(365)}
                </div>
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[90px] select-none">
                52W High
              </th>
              <th className="px-4 py-3.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] text-right min-w-[90px] select-none">
                52W Low
              </th>
            </tr>
          </thead>
          <tbody className={appleTableStyles.tbody}>
            {visibleData.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-20 text-center text-xs text-muted-foreground font-medium">
                  {search.trim()
                    ? `No indices match "${search.trim()}".`
                    : "No index data available."}
                </td>
              </tr>
            )}
            {visibleData.map((idx) => {
              const isGainer = idx.changePercent >= 0;

              return (
                <tr
                  key={idx.name}
                  className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group"
                >
                  <td className="px-4 py-3 text-foreground font-bold hover:text-primary cursor-pointer whitespace-nowrap">
                    {idx.name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.current)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span
                      className={
                        isGainer ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font bg-success/10 text-success border-success/30" : "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font bg-error/10 text-error border-error/30"
                      }
                    >
                      {isGainer ? "+" : ""}
                      {idx.changePercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.open)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.high)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.low)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.prevClose)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.prevDay)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.oneWeekAgo)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.oneMonthAgo)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.oneYearAgo)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.fiftyTwoWeekHigh)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                    {formatNumber(idx.fiftyTwoWeekLow)}
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
