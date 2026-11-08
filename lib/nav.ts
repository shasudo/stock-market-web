/** Single source of truth for every destination.
 *  status: live = built and wired · next = Java endpoint confirmed, queued ·
 *  later = needs a backend or product decision first. */

export type NavStatus = "live" | "next" | "later";

export interface NavEntry {
  code: string;
  label: string;
  href: string;
  blurb: string;
  status: NavStatus;
}

export interface NavGroup {
  id: string;
  label: string;
  entries: NavEntry[];
}

export const NAV: NavGroup[] = [
  {
    id: "terminal",
    label: "Terminal",
    entries: [
      { code: "TODAY", label: "Today", href: "/", blurb: "Mood, key indices, flows", status: "live" },
      { code: "MARKETS", label: "Markets", href: "/markets", blurb: "Screener, indices, IPO", status: "live" },
      { code: "FNO", label: "F&O", href: "/fno", blurb: "Futures snapshot and option chain", status: "live" },
      { code: "MINE", label: "Mine", href: "/mine", blurb: "Watchlists and session", status: "live" },
      { code: "ALERTS", label: "Alerts", href: "/alerts", blurb: "Price-target rules", status: "live" },
      { code: "BROWSE", label: "Browse", href: "/browse", blurb: "Every page, grouped", status: "live" },
    ],
  },
  {
    id: "scans",
    label: "Scans",
    entries: [
      { code: "GAINERS", label: "Gainers", href: "/gainers", blurb: "Top advances by % change", status: "live" },
      { code: "LOSERS", label: "Losers", href: "/losers", blurb: "Top declines by % change", status: "live" },
      { code: "52W-HIGH", label: "52-week highs", href: "/52-week-high", blurb: "At the one-year peak", status: "live" },
      { code: "52W-LOW", label: "52-week lows", href: "/52-week-low", blurb: "At the one-year trough", status: "live" },
      { code: "ATH", label: "All-time highs", href: "/all-time-high", blurb: "Lifetime peaks", status: "live" },
      { code: "ATL", label: "All-time lows", href: "/all-time-low", blurb: "Lifetime troughs", status: "live" },
      { code: "SHOCKERS", label: "Price shockers", href: "/price-shockers", blurb: "Moves of 5% or more", status: "live" },
      { code: "VOLSHOCK", label: "Volume shockers", href: "/volume-shockers", blurb: "Top 100 by volume", status: "live" },
      { code: "ONLYBUY", label: "Only buyers", href: "/only-buyers", blurb: "Locked at upper circuit", status: "live" },
      { code: "ONLYSELL", label: "Only sellers", href: "/only-sellers", blurb: "Locked at lower circuit", status: "live" },
      { code: "ACTIVE", label: "Most active", href: "/most-active-by-value", blurb: "Top 100 by rupee turnover", status: "live" },
    ],
  },
  {
    id: "indices",
    label: "Indices & sectors",
    entries: [
      { code: "INDICES", label: "Indices terminal", href: "/markets?view=indices", blurb: "NSE and BSE boards", status: "live" },
      { code: "NSE-IDX", label: "NSE indices", href: "/market-data/indices/nse", blurb: "Breadth rows and groups", status: "next" },
      { code: "BSE-IDX", label: "BSE indices", href: "/market-data/indices/bse", blurb: "Compact BSE board", status: "next" },
      { code: "FNO-IDX", label: "F&O indices", href: "/market-data/indices-fno", blurb: "Derivatives-eligible indices", status: "next" },
      { code: "BROAD", label: "Broad market", href: "/market-data/broad-market-indices", blurb: "Large, mid and small-cap", status: "next" },
      { code: "SECTORAL", label: "Sectoral indices", href: "/market-data/sectoral-indices", blurb: "Sector index list", status: "live" },
      { code: "SECTORS", label: "Sectors data", href: "/market-data/sectors-data", blurb: "Breadth per sector", status: "live" },
      { code: "NSE-SEC", label: "NSE sectors", href: "/market-data/sectors/nse", blurb: "NSE sector performance", status: "live" },
      { code: "BSE-SEC", label: "BSE sectors", href: "/market-data/sectors/bse", blurb: "BSE sector performance", status: "live" },
      { code: "INDUSTRY", label: "Industry", href: "/market-data/industry", blurb: "Granular industry moves", status: "live" },
      { code: "NIFTYMO", label: "Nifty monthly", href: "/market-data/nifty", blurb: "Seasonality heatmap", status: "live" },
      { code: "PE", label: "Index PE", href: "/market-data/pe", blurb: "Trailing PE history", status: "live" },
      { code: "FNOSTK", label: "F&O stocks", href: "/market-data/fno-stocks", blurb: "Derivatives-eligible stocks", status: "live" },
    ],
  },
  {
    id: "events",
    label: "Deals, flows & calendars",
    entries: [
      { code: "BLOCK", label: "Block deals", href: "/market-data/block-deals", blurb: "Negotiated block trades", status: "live" },
      { code: "BULK", label: "Bulk deals", href: "/market-data/bulk-deals", blurb: "Trades over 0.5% of equity", status: "live" },
      { code: "INTRADAY", label: "Intraday deals", href: "/market-data/intraday-deals", blurb: "Same-day deal tape", status: "live" },
      { code: "CORPACT", label: "Corporate actions", href: "/market-data/corporate-action", blurb: "Dividends, splits, bonuses", status: "live" },
      { code: "CIRCUIT", label: "Circuit changes", href: "/market-data/circuit-changes", blurb: "Revised price bands", status: "live" },
      { code: "BANDHIT", label: "Band hitters", href: "/market-data/price-band-hitters", blurb: "Testing the bands", status: "live" },
      { code: "ADVDEC", label: "Breadth", href: "/market-data/advances-decline-unchanged", blurb: "Advances vs declines", status: "live" },
      { code: "FIIDII", label: "FII / DII", href: "/market-data/fii-dii", blurb: "Daily and monthly flows", status: "live" },
      { code: "RESULTS", label: "Results calendar", href: "/market-data/results-calendar", blurb: "Earnings and macro week", status: "live" },
      { code: "IPO", label: "IPO board", href: "/market-data/ipo", blurb: "Pipeline and listed issues", status: "live" },
      { code: "SUPERINV", label: "Super investors", href: "/market-data/super-investors", blurb: "Tracked portfolios", status: "live" },
      { code: "UNLISTED", label: "Unlisted", href: "/market-data/unlisted-shares", blurb: "Pre-IPO board", status: "live" },
      { code: "GLOBAL", label: "Global markets", href: "/market-data/global-markets", blurb: "Overnight context", status: "live" },
      { code: "MOOD", label: "Market mood", href: "/market-mood", blurb: "0–100 gauge and factors", status: "live" },
      { code: "HIST", label: "Historical data", href: "/market-data/historical-data", blurb: "Per-symbol history", status: "live" },
      { code: "ETF", label: "ETFs", href: "/market-data/etfs", blurb: "Index, gold and smart-beta", status: "live" },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    entries: [
      { code: "QUOTE", label: "Quote", href: "/stock/RELIANCE", blurb: "Price header and ranges", status: "live" },
      { code: "CHART", label: "Chart", href: "/chart/RELIANCE", blurb: "Candles and indicators", status: "live" },
      { code: "CHARTING", label: "Pattern screener", href: "/charting", blurb: "Chart and candle patterns", status: "live" },
      { code: "SCREENER", label: "Screening table", href: "/screening-table", blurb: "Filterable live table", status: "live" },
    ],
  },
  {
    id: "mine",
    label: "Mine & journal",
    entries: [
      { code: "WATCH", label: "Watchlist", href: "/watchlist", blurb: "Folders, levels and notes", status: "live" },
      { code: "PREPO", label: "Preposition", href: "/watchlist/preposition", blurb: "Position sizing drafts", status: "live" },
      { code: "PORTF", label: "Portfolio", href: "/portfolio", blurb: "Holdings and P&L", status: "live" },
      { code: "DIARY", label: "Diary", href: "/diary", blurb: "Trade journal", status: "live" },
      { code: "NOTES", label: "Notes", href: "/notes", blurb: "Symbol-linked notes", status: "live" },
      { code: "EVENTS", label: "My events", href: "/events", blurb: "Personal market calendar", status: "live" },
      { code: "PORTM", label: "Plan", href: "/portfolio/management", blurb: "Capital, regime and splits", status: "live" },
      { code: "STRAT", label: "Strategies", href: "/vgsreddy-strategies", blurb: "Strategies and backtests", status: "live" },
    ],
  },
  {
    id: "account",
    label: "Account & more",
    entries: [
      { code: "LOGIN", label: "Sign in", href: "/login", blurb: "Session and sync", status: "live" },
      { code: "REGISTER", label: "Register", href: "/register", blurb: "Create an account", status: "live" },
      { code: "DASH", label: "Dashboard", href: "/dashboard", blurb: "Personal overview", status: "live" },
      { code: "NEWS", label: "News", href: "/news", blurb: "Market news flow", status: "later" },
    ],
  },
];

export const LIVE_ROUTES = NAV.flatMap((g) => g.entries).filter((e) => e.status === "live");
