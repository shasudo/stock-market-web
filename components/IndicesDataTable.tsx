"use client";

import React, { useState } from "react";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";
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
  EmptyState,
} from "@/components/ds";

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
    <DsTableContainer>
      {/* Title & Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          {title} ({visibleData.length})
        </span>
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search index..."
            className="relative w-48"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Live</span>
            <button
              type="button"
              role="switch"
              aria-checked={streaming}
              aria-label="Toggle live streaming"
              onClick={() => onStreamingChange(!streaming)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                streaming ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  streaming ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <DsTableScroll>
        <DsTable>
          <DsTableHeader>
            <DsRow>
              <DsHead>Index</DsHead>
              <DsHead align="right">Current</DsHead>
              <DsHead align="right">% Change</DsHead>
              <DsHead align="right">Open</DsHead>
              <DsHead align="right">High</DsHead>
              <DsHead align="right">Low</DsHead>
              <DsHead align="right">Prev Close</DsHead>
              <DsHead align="right">
                <div>Prev Day</div>
                <div className="text-[10px] font-normal normal-case tracking-normal">
                  {getDateLabel(1)}
                </div>
              </DsHead>
              <DsHead align="right">
                <div>1W Ago</div>
                <div className="text-[10px] font-normal normal-case tracking-normal">
                  {getDateLabel(7)}
                </div>
              </DsHead>
              <DsHead align="right">
                <div>1M Ago</div>
                <div className="text-[10px] font-normal normal-case tracking-normal">
                  {getDateLabel(30)}
                </div>
              </DsHead>
              <DsHead align="right">
                <div>1Y Ago</div>
                <div className="text-[10px] font-normal normal-case tracking-normal">
                  {getDateLabel(365)}
                </div>
              </DsHead>
              <DsHead align="right">52W High</DsHead>
              <DsHead align="right">52W Low</DsHead>
            </DsRow>
          </DsTableHeader>
          <DsTableBody>
            {visibleData.length === 0 && (
              <DsRow>
                <DsCell colSpan={13} align="center">
                  <EmptyState
                    className="py-10"
                    title={
                      search.trim()
                        ? `No indices match "${search.trim()}".`
                        : "No index data available."
                    }
                  />
                </DsCell>
              </DsRow>
            )}
            {visibleData.map((idx) => (
              <DsRow key={idx.name}>
                <DsCell className="font-semibold">{idx.name}</DsCell>
                <DsNumCell className="font-bold">{formatNumber(idx.current)}</DsNumCell>
                <DsNumCell>
                  <div className="flex items-center justify-end">
                    <ChangePill value={idx.changePercent} />
                  </div>
                </DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.open)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.high)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.low)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.prevClose)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.prevDay)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.oneWeekAgo)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.oneMonthAgo)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.oneYearAgo)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.fiftyTwoWeekHigh)}</DsNumCell>
                <DsNumCell className="font-normal text-muted-foreground">{formatNumber(idx.fiftyTwoWeekLow)}</DsNumCell>
              </DsRow>
            ))}
          </DsTableBody>
        </DsTable>
      </DsTableScroll>
    </DsTableContainer>
  );
}
