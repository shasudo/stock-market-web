"use client";

import { useEffect, useMemo, useState } from "react";
import UnofficialSourceBadge from "@/components/common/UnofficialSourceBadge";
import { Building2, RefreshCw } from "lucide-react";
import {
  fetchFiiDii,
  getFiiDiiClientErrorMessage,
  isFiiDiiRequestAborted,
} from "@/lib/fii-dii/client";
import type { FiiDiiMonthlyDTO } from "@/lib/fii-dii/client";
import type { FiiDiiSource } from "@/lib/fii-dii/nse-client";

const SOURCES: { key: FiiDiiSource; label: string }[] = [
  { key: "combined", label: "Combined (NSE+BSE+MSEI)" },
  { key: "nse", label: "NSE Only" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatNumber(num: number): string {
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function NetValueCell({ value }: { value: number }) {
  const isPositive = value >= 0;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold border num-font ${
        isPositive
          ? "bg-success/10 text-success border-success/30"
          : "bg-error/10 text-error border-error/30"
      }`}
    >
      {isPositive ? "+" : ""}
      ₹{formatNumber(value)}
    </span>
  );
}

export default function FiiDiiTradingPage() {
  const [source, setSource] = useState<FiiDiiSource>("combined");
  const [daily, setDaily] = useState<
    {
      tradeDate: string;
      fiiBuy: number;
      fiiSell: number;
      fiiNet: number;
      diiBuy: number;
      diiSell: number;
      diiNet: number;
    }[]
  >([]);
  const [monthly, setMonthly] = useState<FiiDiiMonthlyDTO[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [fromMonth, setFromMonth] = useState("January");
  const [fromYear, setFromYear] = useState("2025");
  const [toMonth, setToMonth] = useState("December");
  const [toYear, setToYear] = useState("2026");

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await fetchFiiDii(source, controller.signal);
        if (!isCurrent) return;
        setDaily([...response.daily]);
        setMonthly([...response.monthly]);
        setLastSyncAt(response.lastSyncAt);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isCurrent || isFiiDiiRequestAborted(error)) return;
        setErrorMessage(getFiiDiiClientErrorMessage(error));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [source, refreshVersion]);

  const filteredMonthly = useMemo(() => {
    const fromYearNum = Number.parseInt(fromYear, 10);
    const toYearNum = Number.parseInt(toYear, 10);
    const fromIdx = MONTHS.indexOf(fromMonth);
    const toIdx = MONTHS.indexOf(toMonth);
    return monthly.filter((row) => {
      const idx = MONTHS.indexOf(row.month);
      if (row.year < fromYearNum || row.year > toYearNum) return false;
      if (row.year === fromYearNum && idx < fromIdx) return false;
      if (row.year === toYearNum && idx > toIdx) return false;
      return true;
    });
  }, [monthly, fromMonth, fromYear, toMonth, toYear]);

  const latest = daily[0] ?? null;
  const last5 = useMemo(() => daily.slice(0, 5), [daily]);
  const sum5 = useMemo(
    () => ({
      fii: last5.reduce((sum, day) => sum + day.fiiNet, 0),
      dii: last5.reduce((sum, day) => sum + day.diiNet, 0),
    }),
    [last5],
  );

  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <UnofficialSourceBadge
          lastSyncAt={lastSyncAt}
          label="Provisional NSE cash-market flows, published after market close. History builds daily from first sync."
        />

        <div className="bg-card border border-border/80 rounded-2xl p-6 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-primary/20 shadow-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                FII &amp; DII Institutional Activity
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                Cash-market flows (₹ in Crores) ·{" "}
                {source === "combined"
                  ? "NSE + BSE + MSEI"
                  : "NSE segment only"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="flex space-x-2 bg-transparent p-1 overflow-x-auto mb-4">
          {SOURCES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSource(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all shadow-xs whitespace-nowrap ${
                source === tab.key
                  ? "bg-primary text-primary-foreground shadow-primary/20"
                  : "bg-card border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          >
            {errorMessage}
          </p>
        ) : null}

        {isLoading && daily.length === 0 ? (
          <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-8 text-center">
            <p className="text-muted-foreground">Loading live FII/DII flows…</p>
          </div>
        ) : daily.length === 0 ? (
          <div className="rounded-2xl border border-border/90 bg-card shadow-xs p-8 text-center">
            <p className="text-muted-foreground">
              No FII/DII flows stored yet. The daily sync runs after market
              close; today&apos;s provisional numbers appear once NSE publishes
              them.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border/90 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Latest session{latest ? ` · ${formatDate(latest.tradeDate)}` : ""}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span>FII net</span>
                  {latest ? <NetValueCell value={latest.fiiNet} /> : null}
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span>DII net</span>
                  {latest ? <NetValueCell value={latest.diiNet} /> : null}
                </div>
              </div>
              <div className="bg-card border border-border/90 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Last 5 sessions net
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span>FII net</span>
                  <NetValueCell value={sum5.fii} />
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span>DII net</span>
                  <NetValueCell value={sum5.dii} />
                </div>
              </div>
              <div className="bg-card border border-border/90 rounded-2xl p-4 shadow-xs">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Coverage
                </p>
                <p className="text-sm text-foreground">
                  {daily.length} trading day{daily.length === 1 ? "" : "s"} ·{" "}
                  {monthly.length} month{monthly.length === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Monthly totals are summed from stored daily flows.
                </p>
              </div>
            </div>

            <div className="bg-card border border-border/90 rounded-2xl overflow-hidden shadow-xs mb-8">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Date
                      </th>
                      <th
                        colSpan={3}
                        className="py-2.5 px-3.5 text-center text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 border-x border-primary/20 select-none"
                      >
                        FII (₹ Crores)
                      </th>
                      <th
                        colSpan={3}
                        className="py-2.5 px-3.5 text-center text-xs font-bold text-purple-700 uppercase tracking-wider bg-purple-50/50 select-none"
                      >
                        DII (₹ Crores)
                      </th>
                    </tr>
                    <tr className="border-t border-border">
                      <th className="py-2.5 px-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none"></th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border select-none">
                        Gross Buy
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Gross Sell
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r border-border select-none">
                        Net
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Gross Buy
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Gross Sell
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {daily.map((row) => (
                      <tr
                        key={row.tradeDate}
                        className="transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50"
                      >
                        <td className="py-2.5 px-3.5 text-xs font-semibold text-foreground whitespace-nowrap">
                          {formatDate(row.tradeDate)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground border-l border-border num-font whitespace-nowrap">
                          ₹{formatNumber(row.fiiBuy)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(row.fiiSell)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right border-r border-border whitespace-nowrap">
                          <NetValueCell value={row.fiiNet} />
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(row.diiBuy)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(row.diiSell)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right whitespace-nowrap">
                          <NetValueCell value={row.diiNet} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-card border border-border/90 rounded-2xl p-5 mb-4 shadow-xs">
              <h2 className="text-base font-bold text-foreground mb-4">
                Monthly Institutional Flow Totals
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={fromMonth}
                    onChange={(e) => setFromMonth(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold bg-card text-foreground focus:border-ring focus:outline-none"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fromYear}
                    onChange={(e) => setFromYear(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold bg-card text-foreground focus:border-ring focus:outline-none"
                  >
                    {["2024", "2025", "2026"].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-muted-foreground text-xs font-bold uppercase">To</span>
                <div className="flex items-center gap-2">
                  <select
                    value={toMonth}
                    onChange={(e) => setToMonth(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold bg-card text-foreground focus:border-ring focus:outline-none"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={toYear}
                    onChange={(e) => setToYear(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-xl text-xs font-semibold bg-card text-foreground focus:border-ring focus:outline-none"
                  >
                    {["2024", "2025", "2026"].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setFromMonth("January");
                    setFromYear("2025");
                    setToMonth("December");
                    setToYear("2026");
                  }}
                  className="px-4 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors ml-auto"
                >
                  Reset Range
                </button>
              </div>
            </div>

            <div className="bg-card border border-border/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead className="bg-muted/90 backdrop-blur-md border-b border-border sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3.5 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Period
                      </th>
                      <th
                        colSpan={3}
                        className="py-2.5 px-3.5 text-center text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 border-x border-primary/20 select-none"
                      >
                        FII (₹ Crores)
                      </th>
                      <th
                        colSpan={3}
                        className="py-2.5 px-3.5 text-center text-xs font-bold text-purple-700 uppercase tracking-wider bg-purple-50/50 select-none"
                      >
                        DII (₹ Crores)
                      </th>
                    </tr>
                    <tr className="border-t border-border">
                      <th className="py-2.5 px-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none"></th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border select-none">
                        Gross Buy
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Gross Sell
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r border-border select-none">
                        Net
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Gross Buy
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Gross Sell
                      </th>
                      <th className="py-2.5 px-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMonthly.map((row) => (
                      <tr
                        key={`${row.month}-${row.year}`}
                        className="transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50"
                      >
                        <td className="py-2.5 px-3.5 text-xs font-bold text-primary whitespace-nowrap">
                          {row.month} {row.year} · {row.tradingDays}d
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground border-l border-border num-font whitespace-nowrap">
                          ₹{formatNumber(row.fiiBuy)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(row.fiiSell)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right border-r border-border whitespace-nowrap">
                          <NetValueCell value={row.fiiNet} />
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(row.diiBuy)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right font-mono text-muted-foreground num-font whitespace-nowrap">
                          ₹{formatNumber(row.diiSell)}
                        </td>
                        <td className="py-2.5 px-3.5 text-xs text-right whitespace-nowrap">
                          <NetValueCell value={row.diiNet} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
