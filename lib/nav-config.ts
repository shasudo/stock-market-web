import {
  LayoutDashboard,
  Bell,
  CalendarDays,
  CalendarClock,
  Eye,
  TrendingUp,
  FileText,
  PieChart,
  StickyNote,
  BookOpen,
  Briefcase,
  CandlestickChart,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export interface NavLinkItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  highlight?: boolean;
}

export const navLinks: NavLinkItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chart/NIFTY", label: "Charts", icon: CandlestickChart },
  { href: "/screens", label: "FA Screener", icon: LayoutGrid },
];

export const alertSourceLinks: NavLinkItem[] = [
  { href: "/alerts?source=watchlist", label: "Watchlist", icon: Eye },
  {
    href: "/alerts?source=preposition",
    label: "Preposition Watchlist",
    icon: Eye,
  },
  { href: "/alerts?source=paper", label: "Paper Trading", icon: FileText },
  { href: "/alerts?source=live", label: "Live Trading", icon: TrendingUp },
  { href: "/alerts?source=others", label: "Others", icon: Bell },
];

export const watchlistLinks: NavLinkItem[] = [
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  {
    href: "/watchlist/preposition",
    label: "Preposition Watchlist",
    icon: Eye,
  },
];

export const portfolioLinks: NavLinkItem[] = [
  { href: "/portfolio/holdings", label: "Holdings", icon: Briefcase },
  { href: "/portfolio/live-trading", label: "Live Trading", icon: TrendingUp },
  { href: "/portfolio/paper-trading", label: "Paper Trading", icon: FileText },
  {
    href: "/portfolio/management",
    label: "Portfolio Management",
    icon: PieChart,
  },
];

export const notesLinks: NavLinkItem[] = [
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/diary", label: "Diary", icon: BookOpen },
  { href: "/events", label: "Event Manager", icon: CalendarClock },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export const screenersLinks = {
  technical: {
    screeningTable: [
      { href: "/screeners/screening-table", label: "Screening Table" },
    ],
    candlestickPatterns: [
      { href: "#", label: "Single Candlestick Patterns" },
      { href: "#", label: "Dual Candlestick Patterns" },
      { href: "#", label: "Three Candlestick Patterns" },
      { href: "/screeners/vgsreddy-strategies", label: "VGS Reddy Screener" },
    ],
    chartPatterns: [
      { href: "#", label: "Bullish Chart Patterns" },
      { href: "#", label: "Bearish Chart Patterns" },
    ],
    drawingTools: [
      { href: "#", label: "Support & Resistance" },
      { href: "#", label: "Trendline" },
      { href: "#", label: "Price Action" },
      { href: "#", label: "Swing High & Lows" },
      { href: "#", label: "Demand & Supply Zones" },
    ],
    indicators: [] as NavLinkItem[],
    strategies: [] as NavLinkItem[],
  },
  fundamental: [] as NavLinkItem[],
};

export const analysisLinks = {
  technicals: [
    { href: "/analysis/strategy-builder", label: "Strategy Builder" },
    { href: "/analysis/strategy-back-test", label: "Strategy Back Test" },
    {
      href: "/analysis/strategy-back-test-group",
      label: "Strategy Back Test Group",
    },
    { href: "/analysis/reports", label: "Reports" },
  ] as NavLinkItem[],
  fundamentals: [] as NavLinkItem[],
};

export const marketDataLinks = {
  marketOverview: {
    indices: [
      { href: "/market-data/indices/nse", label: "NSE Indices" },
      { href: "/market-data/indices/bse", label: "BSE Indices" },
    ],
    sectors: [
      { href: "/market-data/sectors/nse", label: "NSE Sectors" },
      { href: "/market-data/sectors/bse", label: "BSE Sectors" },
    ],
    totalMarket: [
      { href: "#", label: "Total Market" },
      { href: "#", label: "Advances, Decline & Unchange" },
      { href: "/market", label: "Total Market Performance" },
    ],
    marketMood: [{ href: "/market-mood", label: "Market Mood" }],
    futuresSupport: [{ href: "#", label: "Futures Support & Resistance" }],
    globalMarkets: [
      { href: "/market-data/global-markets", label: "Global Markets" },
    ],
    filterings: [{ href: "#", label: "Filterings" }],
  },
  equity: [
    { href: "/market-data/indices-fno", label: "Indices in F&O" },
    {
      href: "/market-data/broad-market-indices",
      label: "Broad Market Indices",
    },
    { href: "/market-data/sectoral-indices", label: "Sectoral Indices" },
    { href: "/market-data/pre-open", label: "Pre Open" },
    { href: "/market-data/stocks", label: "Stocks" },
    { href: "/market-data/sectors-data", label: "Sectors" },
    { href: "/market-data/industry", label: "Industry" },
    { href: "/market-data/fno-stocks", label: "F&O Stocks" },
    { href: "/market-data/price-band-hitters", label: "Price Band Hitters" },
    { href: "/market-data/fno", label: "F&O Data" },
    { href: "/market-data/ipo", label: "IPO's" },
    { href: "#", label: "All Statistics" },
    { href: "/gainers", label: "Top Gainers" },
    { href: "/losers", label: "Top Losers" },
    { href: "/only-buyers", label: "Only Buyers" },
    { href: "/only-sellers", label: "Only Sellers" },
    { href: "/price-shockers", label: "Price Shockers" },
    { href: "/volume-shockers", label: "Volume Shockers" },
    { href: "/most-active-by-value", label: "Most Active By Value" },
    { href: "/52-week-high", label: "52 Wk High" },
    { href: "/52-week-low", label: "52 Wk Low" },
    { href: "/all-time-high", label: "All Time High" },
    { href: "/all-time-low", label: "All Time Low" },
    { href: "/market-data/etfs", label: "ETFs" },
    { href: "/market-data/unlisted-shares", label: "Unlisted Shares" },
  ],
  others: {
    general: [
      { href: "/market-data/results-calendar", label: "Calendar" },
      { href: "#", label: "FII & DII Activity" },
      { href: "#", label: "Promoters Activity" },
      { href: "#", label: "Mutual Funds Activity" },
      { href: "#", label: "Super Investors", highlight: true },
      { href: "/market-data/corporate-action", label: "Corporate Action" },
    ],
    deals: [
      { href: "#", label: "Deals" },
      { href: "#", label: "Bulk Deals" },
      { href: "#", label: "Block Deals" },
      { href: "#", label: "Intraday Large Deals" },
      { href: "/market-data/circuit-changes", label: "Circuit Changes" },
      { href: "#", label: "Monthly" },
    ],
    nifty: [
      { href: "/market-data/nifty", label: "Nifty" },
      { href: "/market-data/pe", label: "PE" },
    ],
  },
};
