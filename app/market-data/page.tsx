"use client";

import Link from "next/link";

const marketDataRows = [
  ["Indices", "Indices in F&O", "Calendar"],
  ["NSE Indices", "Broad Market Indices", "FII & DII Activity"],
  ["BSE Indices", "Sectoral Indices", ""],
  ["", "Stocks", ""],
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

// Category headers with no destination page render as plain text, never links.
const plainItems = new Set(["Indices", "Monthly", "Deals", "Filterings"]);

const customHrefs: Record<string, string> = {
  "Indices in F&O": "/market-data/indices-fno",
  "Broad Market Indices": "/market-data/broad-market-indices",
  "Sectoral Indices": "/market-data/sectoral-indices",
  Calendar: "/market-data/results-calendar",
  "Total Market": "/market",
  "All Statistics": "/market",
  "Market Mood": "/market-mood",
  "NSE Indices": "/market-data/indices/nse",
  "BSE Indices": "/market-data/indices/bse",
  "NSE Sectors": "/market-data/sectors/nse",
  "BSE Sectors": "/market-data/sectors/bse",
  Sectors: "/market-data/sectors-data",
  "FII & DII Activity": "/market-data/fii-dii",
  "F&O Stocks": "/market-data/fno-stocks",
  "IPO's": "/market-data/ipo",
  "Futures Support & Resistance": "/market-data/fno",
  "Intraday Large Deals": "/market-data/intraday-deals",
  "Top Gainers": "/gainers",
  "Top Losers": "/losers",
  "Only Buyers": "/only-buyers",
  "Only Sellers": "/only-sellers",
  "Price Shockers": "/price-shockers",
  "Volume Shockers": "/volume-shockers",
  "Most Active Stocks": "/most-active-by-value",
  "52 Week High": "/52-week-high",
  "52 Week Low": "/52-week-low",
  "All Time High (ATH)": "/all-time-high",
  "All Time Low (ATL)": "/all-time-low",
};

function isBold(text: string): boolean {
  return boldItems.includes(text);
}

function getHref(text: string): string | null {
  if (!text || plainItems.has(text)) return null;
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
                  {[row[0], row[1], row[2]].map((text, cell) => {
                    if (!text) return <td key={cell} className={cell === 2 ? "py-2 px-4 text-sm text-muted-foreground font-medium" : "py-2 px-4 border-r border-border text-sm text-muted-foreground font-medium"} />;
                    const href = getHref(text);
                    const className = `text-muted-foreground hover:text-primary hover:no-underline transition-colors ${isBold(text) ? "font-bold" : ""}`;
                    return (
                      <td key={cell} className={cell === 2 ? "py-2 px-4 text-sm text-muted-foreground font-medium" : "py-2 px-4 border-r border-border text-sm text-muted-foreground font-medium"}>
                        {href ? <Link href={href} className={className}>{text}</Link> : <span className={className}>{text}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
