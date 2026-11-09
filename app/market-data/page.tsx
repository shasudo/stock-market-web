"use client";

import Link from "next/link";

const marketDataRows = [
  ["Indices", "Indices in F&O", "Calendar"],
  ["NSE Indices", "Broad Market Indices", "FII & DII Activity"],
  ["BSE Indices", "Sectoral Indices", "Promoters Activity"],
  ["", "Stocks", "Mutual Funds Activity"],
  ["Sectors", "Sectors", "Super Investors"],
  ["NSE Sectors", "Industry", "Corporate Action"],
  ["BSE Sectors", "F&O Stocks", "Deals"],
  ["", "IPO's", "Bulk Deals"],
  ["Total Market", "All Statistics", "Block Deals"],
  ["Advances, Decline & Unchanged", "Top Gainers", "Intraday Large Deals"],
  ["", "Top Losers", "Monthly"],
  ["Market Mood", "Only Buyers", "Nifty"],
  ["", "Only Sellers", "PE"],
  ["Futures Support & Resistance", "52 Week High", ""],
  ["", "52 Week Low", ""],
  ["Global Markets", "All Time High (ATH)", ""],
  ["", "All Time Low (ATL)", ""],
  ["", "Price Shockers", ""],
  ["", "Volume Shockers", ""],
  ["", "Most Active Stocks", ""],
  ["", "ETFs", ""],
  ["", "Unlisted Shares", ""],
  ["Filterings", "Filterings", "Filterings"],
];

const boldItems = [
  "Indices",
  "Sectors",
  "Total Market",
  "Market Mood",
  "Global Markets",
  "Filterings",
  "Monthly",
  "Deals",
];

function isBold(text: string): boolean {
  return boldItems.includes(text);
}

const customHrefs: Record<string, string> = {
  "Indices in F&O": "/market-data/indices-fno",
  "Broad Market Indices": "/market-data/broad-market-indices",
  "Sectoral Indices": "/market-data/sectoral-indices",
  Calendar: "/market-data/results-calendar",
};

function getHref(text: string): string {
  if (!text) return "#";
  if (customHrefs[text]) return customHrefs[text];
  const slug = text
    .toLowerCase()
    .replace(/[&',()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/market-data/${slug}`;
}

export default function MarketDataPage() {
  return (
    <div className="min-h-screen bg-background py-6">
      <div className="w-full px-4 lg:px-8">
        <div className="rounded-2xl border border-border/90 bg-card shadow-xs overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th
                  colSpan={3}
                  className="py-3 px-4 text-center text-xl font-extrabold tracking-tight text-foreground border-b border-border bg-muted/80"
                >
                  Market Data
                </th>
              </tr>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-1/3 py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border bg-card">
                  Market Overview
                </th>
                <th className="w-1/3 py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border bg-card">
                  Equity
                </th>
                <th className="w-1/3 py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-card">
                  Others
                </th>
              </tr>
            </thead>
            <tbody>
              {marketDataRows.map((row, idx) => (
                <tr key={idx} className="finder-row transition-colors border-b border-border/80 hover:bg-primary/10 even:bg-card odd:bg-muted/50 group">
                  <td className="py-2 px-4 border-r border-border text-sm text-muted-foreground font-medium">
                    {row[0] ? (
                      <Link
                        href={getHref(row[0])}
                        className={`text-muted-foreground hover:text-primary hover:no-underline transition-colors ${isBold(row[0]) ? "font-bold" : ""}`}
                      >
                        {row[0]}
                      </Link>
                    ) : null}
                  </td>
                  <td className="py-2 px-4 border-r border-border text-sm text-muted-foreground font-medium">
                    {row[1] ? (
                      <Link
                        href={getHref(row[1])}
                        className={`text-muted-foreground hover:text-primary hover:no-underline transition-colors ${isBold(row[1]) ? "font-bold" : ""}`}
                      >
                        {row[1]}
                      </Link>
                    ) : null}
                  </td>
                  <td className="py-2 px-4 text-sm text-muted-foreground font-medium">
                    {row[2] ? (
                      <Link
                        href={getHref(row[2])}
                        className={`text-muted-foreground hover:text-primary hover:no-underline transition-colors ${isBold(row[2]) ? "font-bold" : ""}`}
                      >
                        {row[2]}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
