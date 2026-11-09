"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { circuitChangesBSE } from "@/lib/mockData";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import { SearchInput, matchesSearch } from "@/components/common/SearchInput";
import {
  fetchScrapedEvents,
  getScrapedEventClientErrorMessage,
  isScrapedEventRequestAborted,
} from "@/lib/scrape/scraped-event-client";
import type { CircuitHitDTO } from "@/lib/scrape/scraped-event-client";

const REFRESH_INTERVAL_MS = 60_000;

type ExchangeTab = "nse" | "bse";

function NSECircuitChanges() {
  const [hits, setHits] = useState<CircuitHitDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [symbolFilter, setSymbolFilter] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchScrapedEvents<CircuitHitDTO>(
          "/api/market-data/circuit-changes",
          controller.signal,
        );
        if (!isCurrentRequest) return;
        setHits([...response.events]);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrentRequest || isScrapedEventRequestAborted(error)) return;
        setErrorMessage(getScrapedEventClientErrorMessage(error));
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [refreshVersion]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const filteredData = useMemo(() => {
    if (!symbolFilter.trim()) return hits;
    const q = symbolFilter.toLowerCase();
    return hits.filter(
      (r) =>
        r.symbol.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q),
    );
  }, [hits, symbolFilter]);

  return (
    <div>
      <div className="px-6 py-5 border-b border-border">
        <UnofficialSourceBadge lastSyncAt={lastSyncAt} />
        <h3 className="text-base font-semibold text-foreground border-b-2 border-indigo-700 inline-block pb-2 mb-2 mt-2">
          Note
        </h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2 mt-3">
          <li>
            Securities that hit their upper (H) or lower (L) price band on the
            most recent trading day.
          </li>
        </ul>
      </div>

      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Filter By :
          </span>
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <span className="bg-muted text-sm text-muted-foreground px-3 py-2 border-r border-border">
              Symbol
            </span>
            <div className="relative">
              <input
                type="text"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="pl-3 pr-8 py-2 text-sm w-48 focus:outline-none"
              />
              {symbolFilter && (
                <button
                  onClick={() => setSymbolFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <p role="alert" className="mx-6 mt-4 text-sm text-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#1a237e] text-white">
              <th className="px-4 py-3 text-left font-semibold">SYMBOL</th>
              <th className="px-4 py-3 text-left font-semibold">
                SECURITY NAME
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                HIGH / LOW BAND
              </th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {isLoading && filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading circuit data…
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No records found
                </td>
              </tr>
            ) : (
              filteredData.map((row, index) => (
                <tr
                  key={`${row.symbol}-${index}`}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href="#"
                      className="text-info hover:underline font-medium"
                    >
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.companyName}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    <span
                      className={
                        row.highOrLow === "H" ? "text-success" : "text-error"
                      }
                    >
                      {row.highOrLow === "H" ? "Upper" : "Lower"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BSECircuitChanges() {
  const [segmentName, setSegmentName] = useState("All");
  const [search, setSearch] = useState("");

  const segments = ["All", "Equity", "Debt", "Mutual Fund", "General"];

  const rowsInSegment = useMemo(() => {
    return circuitChangesBSE.filter(
      (row) => segmentName === "All" || row.segmentName === segmentName,
    );
  }, [segmentName]);

  const filteredData = useMemo(
    () =>
      rowsInSegment.filter((row) =>
        matchesSearch(
          search,
          row.noticeNo,
          row.subject,
          row.categoryName,
          row.department,
        ),
      ),
    [rowsInSegment, search],
  );

  return (
    <div>
      <div className="px-6 py-4 border-b border-border">
        <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-amber-800">
          <span aria-hidden="true">⚠</span>
          <span>
            Demo data — no verified unauthenticated BSE circulars source was
            found for this build; not a live feed.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">
            Segment Name:
          </label>
          <select
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {segments.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search notice, subject, department..."
            className="relative w-full sm:w-80"
            inputClassName="w-full rounded-md border border-border bg-card py-2 pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            matchCount={filteredData.length}
            totalCount={rowsInSegment.length}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-warning dark:text-zinc-950 text-white">
              <th className="px-4 py-3 text-left font-semibold">Notice No</th>
              <th className="px-4 py-3 text-left font-semibold">Subject</th>
              <th className="px-4 py-3 text-left font-semibold">
                Segment Name
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                Category Name
              </th>
              <th className="px-4 py-3 text-left font-semibold">Department</th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {search.trim()
                    ? `No records match "${search.trim()}".`
                    : "No records found."}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.noticeNo}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground font-medium">
                    {row.noticeNo}
                  </td>
                  <td className="px-4 py-3">
                    <Link href="#" className="text-info hover:underline">
                      {row.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.segmentName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.categoryName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.department}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CircuitChangesView() {
  const [activeTab, setActiveTab] = useState<ExchangeTab>("nse");

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="px-6 py-5 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Circuit Changes</h1>
      </div>

      <div className="px-6 border-b border-border">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("nse")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "nse"
                ? "border-indigo-700 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            NSE
          </button>
          <button
            onClick={() => setActiveTab("bse")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "bse"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            BSE
          </button>
        </div>
      </div>

      {activeTab === "nse" ? <NSECircuitChanges /> : <BSECircuitChanges />}
    </div>
  );
}
